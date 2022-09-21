import { put, takeEvery, select, call, takeLatest, fork, take, race, delay, apply } from 'redux-saga/effects'

import { commsEstablished, FATAL_ERROR } from 'shared/loading/types'
import { CommsContext, commsLogger } from './context'
import { getCommsContext, getRealm } from './selectors'
import { BEFORE_UNLOAD } from 'shared/protocol/actions'
import {
  HandleCommsDisconnection,
  HANDLE_COMMS_DISCONNECTION,
  setWorldContext,
  SET_COMMS_ISLAND,
  SET_WORLD_CONTEXT
} from './actions'
import { notifyStatusThroughChat } from 'shared/chat'
import { bindHandlersToCommsContext, createSendMyProfileOverCommsChannel } from './handlers'
import { DEPLOY_PROFILE_SUCCESS, SEND_PROFILE_TO_RENDERER } from 'shared/profiles/actions'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { Avatar, IPFSv2, Snapshots } from '@dcl/schemas'
import { genericAvatarSnapshots } from 'config'
import { isURL } from 'atomicHelpers/isURL'
import { processAvatarVisibility } from './peers'
import { getFatalError } from 'shared/loading/selectors'
import { EventChannel } from 'redux-saga'
import { ExplorerIdentity } from 'shared/session/types'
import { getIdentity } from 'shared/session'
import { USER_AUTHENTIFIED } from 'shared/session/actions'
import { selectAndReconnectRealm } from 'shared/dao/sagas'
import { realmToConnectionString } from './v3/resolver'
import { waitForMetaConfigurationInitialization } from 'shared/meta/sagas'
import { getMaxVisiblePeers } from 'shared/meta/selectors'

const TIME_BETWEEN_PROFILE_RESPONSES = 1000
const INTERVAL_ANNOUNCE_PROFILE = 1000

export function* commsSaga() {
  yield takeLatest(HANDLE_COMMS_DISCONNECTION, handleCommsDisconnection)

  yield takeEvery(FATAL_ERROR, function* () {
    // set null context on fatal error. this will bring down comms.
    yield put(setWorldContext(undefined))
  })

  yield takeEvery(BEFORE_UNLOAD, function* () {
    // this would disconnect the comms context
    yield put(setWorldContext(undefined))
  })

  yield fork(handleNewCommsContext)

  // respond to profile requests over comms
  yield fork(respondCommsProfileRequests)

  yield fork(handleAnnounceProfile)
  yield fork(initAvatarVisibilityProcess)
  yield fork(handleCommsReconnectionInterval)
}

function* initAvatarVisibilityProcess() {
  yield call(waitForMetaConfigurationInitialization)
  const maxVisiblePeers = yield select(getMaxVisiblePeers)

  while (true) {
    const reason = yield race({
      delay: delay(100),
      unload: take(BEFORE_UNLOAD)
    })

    if (reason.unload) break

    const context: CommsContext | null = yield select(getCommsContext)
    const account: ExplorerIdentity | undefined = yield select(getIdentity)

    processAvatarVisibility(maxVisiblePeers, context, account?.address)
  }
}

/**
 * This handler sends profile responses over comms.
 */
function* respondCommsProfileRequests() {
  const chan: EventChannel<void> = yield call(createSendMyProfileOverCommsChannel)

  let lastMessage = 0
  while (true) {
    // wait for the next event of the channel
    yield take(chan)

    const context = (yield select(getCommsContext)) as CommsContext | undefined
    const profile: Avatar | null = yield select(getCurrentUserProfile)
    const identity: ExplorerIdentity | null = yield select(getIdentity)

    if (profile && context && context.currentPosition) {
      profile.hasConnectedWeb3 = identity?.hasConnectedWeb3 || profile.hasConnectedWeb3

      // naive throttling
      const now = Date.now()
      const elapsed = now - lastMessage
      if (elapsed < TIME_BETWEEN_PROFILE_RESPONSES) continue
      lastMessage = now

      const connection = context.worldInstanceConnection
      yield apply(connection, connection.sendProfileResponse, [context.currentPosition, stripSnapshots(profile)])
    }
  }
}

function stripSnapshots(profile: Avatar): Avatar {
  const newSnapshots: Record<string, string> = {}
  const currentSnapshots: Record<string, string> = profile.avatar.snapshots

  for (const snapshotKey of ['face256', 'body'] as const) {
    const snapshot = currentSnapshots[snapshotKey]
    const defaultValue = genericAvatarSnapshots[snapshotKey]
    const newValue =
      snapshot &&
      (snapshot.startsWith('/') || snapshot.startsWith('./') || isURL(snapshot) || IPFSv2.validate(snapshot))
        ? snapshot
        : null
    newSnapshots[snapshotKey] = newValue || defaultValue
  }

  return {
    ...profile,
    avatar: { ...profile.avatar, snapshots: newSnapshots as Snapshots }
  }
}

/**
 * This saga handle reconnections of comms contexts.
 */
function* handleCommsReconnectionInterval() {
  while (true) {
    const reason: any = yield race({
      SET_WORLD_CONTEXT: take(SET_WORLD_CONTEXT),
      USER_AUTHENTIFIED: take(USER_AUTHENTIFIED),
      timeout: delay(1000)
    })

    const context: CommsContext | undefined = yield select(getCommsContext)
    const hasFatalError: string | undefined = yield select(getFatalError)
    const identity: ExplorerIdentity | undefined = yield select(getIdentity)

    const shouldReconnect = !context && !hasFatalError && identity?.address
    if (shouldReconnect) {
      // reconnect
      commsLogger.info('Trying to reconnect to a realm. reason:', Object.keys(reason)[0])
      yield call(selectAndReconnectRealm)
    }
  }
}

/**
 * This saga waits for one of the conditions that may trigger a
 * sendCurrentProfile and then does it.
 */
function* handleAnnounceProfile() {
  while (true) {
    yield race({
      SEND_PROFILE_TO_RENDERER: take(SEND_PROFILE_TO_RENDERER),
      DEPLOY_PROFILE_SUCCESS: take(DEPLOY_PROFILE_SUCCESS),
      SET_COMMS_ISLAND: take(SET_COMMS_ISLAND),
      timeout: delay(INTERVAL_ANNOUNCE_PROFILE),
      SET_WORLD_CONTEXT: take(SET_WORLD_CONTEXT)
    })

    const context: CommsContext | undefined = yield select(getCommsContext)
    const profile: Avatar | null = yield select(getCurrentUserProfile)

    if (context && profile) {
      context.sendCurrentProfile(profile.version)
    }
  }
}

// this saga reacts to changes in context and disconnects the old context
function* handleNewCommsContext() {
  let currentContext: CommsContext | undefined = undefined

  yield takeEvery(SET_WORLD_CONTEXT, function* () {
    const oldContext = currentContext
    currentContext = yield select(getCommsContext)

    if (currentContext) {
      // bind messages to this comms instance
      yield call(bindHandlersToCommsContext, currentContext)
      yield put(commsEstablished())
      notifyStatusThroughChat(`Welcome to realm ${realmToConnectionString(currentContext.realm)}!`)
    }

    if (oldContext && oldContext !== currentContext) {
      // disconnect previous context
      yield call(disconnectContext, oldContext)
    }
  })
}

async function disconnectContext(context: CommsContext) {
  try {
    await context.disconnect()
  } catch (err: any) {
    // this only needs to be logged. try {} catch is used because the function needs
    // to wait for the disconnection to continue with the saga.
    commsLogger.error(err)
  }
}

// this saga handles the suddenly disconnection of a CommsContext
function* handleCommsDisconnection(action: HandleCommsDisconnection) {
  const realm = yield select(getRealm)

  const context: CommsContext = yield select(getCommsContext)

  if (context && context === action.payload.context) {
    // this also remove the context
    yield put(setWorldContext(undefined))

    if (realm) {
      notifyStatusThroughChat(`Lost connection to ${realmToConnectionString(realm)}`)
    }
  }
}
