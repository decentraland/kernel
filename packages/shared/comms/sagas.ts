import { put, takeEvery, select, call, takeLatest, fork, throttle, take, race, delay } from 'redux-saga/effects'

import { commsEstablished, FATAL_ERROR } from 'shared/loading/types'
import { triggerReconnectRealm } from 'shared/dao/actions'
import { CommsContext, commsLogger } from './context'
import { getCommsContext, getRealm } from './selectors'
import { BEFORE_UNLOAD } from 'shared/protocol/actions'
import { voiceSaga } from './voice-sagas'
import {
  HandleCommsDisconnection,
  HANDLE_COMMS_DISCONNECTION,
  LoadProfileIfNecessaryAction,
  LOAD_REMOTE_PROFILE_IF_NECESSARY,
  SEND_MY_PROFILE_OVER_COMMS,
  setWorldContext,
  SET_COMMS_ISLAND,
  SET_WORLD_CONTEXT
} from './actions'
import { notifyStatusThroughChat } from 'shared/chat'
import { realmToConnectionString } from 'shared/dao/utils/realmToString'
import { bindHandlersToCommsContext } from './handlers'
import { DEPLOY_PROFILE_SUCCESS, SEND_PROFILE_TO_RENDERER } from 'shared/profiles/actions'
import { getCurrentUserProfile, getProfileFromStore } from 'shared/profiles/selectors'
import { Avatar, IPFSv2, Snapshots } from '@dcl/schemas'
import { genericAvatarSnapshots } from 'config'
import { isURL } from 'atomicHelpers/isURL'
import { ProfileAsPromise } from 'shared/profiles/ProfileAsPromise'
import { processAvatarVisibility } from './peers'
import { getFatalError } from 'shared/loading/selectors'
import { ProfileUserInfo } from 'shared/profiles/types'
import { trackEvent } from 'shared/analytics'

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

  yield fork(voiceSaga)
  yield fork(handleNewCommsContext)
  yield throttle(TIME_BETWEEN_PROFILE_RESPONSES, SEND_MY_PROFILE_OVER_COMMS, sendProfileToComms)
  yield takeEvery(LOAD_REMOTE_PROFILE_IF_NECESSARY, loadProfileIfNecessary)
  yield fork(handleAnnounceProfile)
  yield fork(initAvatarVisibilityProcess)
  yield fork(handleCommsReconnectionInterval)
}

function* initAvatarVisibilityProcess() {
  const interval = setInterval(processAvatarVisibility, 100)
  yield take(BEFORE_UNLOAD)
  clearInterval(interval)
}

/**
 * This handler sends profile responses over comms.
 */
function* sendProfileToComms() {
  const context = (yield select(getCommsContext)) as CommsContext | undefined
  const profile: Avatar | null = yield select(getCurrentUserProfile)

  if (profile && context && context.currentPosition) {
    yield context.worldInstanceConnection.sendProfileResponse(context.currentPosition, stripSnapshots(profile))
  }
}

function stripSnapshots(profile: Avatar): Avatar {
  const newSnapshots: Record<string, string> = {}
  const currentSnapshots: Record<string, string> = profile.avatar.snapshots

  for (const snapshotKey of ['face256', 'body'] as const) {
    const snapshot = currentSnapshots[snapshotKey]
    newSnapshots[snapshotKey] =
      snapshot &&
      (snapshot.startsWith('/') || snapshot.startsWith('./') || isURL(snapshot) || IPFSv2.validate(snapshot))
        ? snapshot
        : genericAvatarSnapshots[snapshotKey]
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
    yield take(SET_WORLD_CONTEXT)
    yield delay(1000)

    const context: CommsContext | undefined = yield select(getCommsContext)
    const hasFatalError: string | undefined = yield select(getFatalError)

    if (!context && !hasFatalError) {
      // reconnect
      yield put(triggerReconnectRealm())
      commsLogger.info('Trying to reconnect to a realm')
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
    currentContext = (yield select(getCommsContext)) as CommsContext | undefined

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
    // this also disconnects the context.
    yield put(setWorldContext(undefined))

    if (realm) {
      notifyStatusThroughChat(`Lost connection to ${realmToConnectionString(realm)}`)
    }

    yield put(triggerReconnectRealm())
  }
}

/**
 * When a profile announcement is made via comms, then we must update the
 * profile locally.
 */
function* loadProfileIfNecessary(action: LoadProfileIfNecessaryAction) {
  const { userId, version, profileType: type } = action.payload
  const localProfile: ProfileUserInfo | null = yield select(getProfileFromStore, userId)

  const shouldLoadRemoteProfile =
    !localProfile ||
    localProfile.status == 'error' ||
    (localProfile.status == 'ok' && localProfile.data.version < version)

  if (shouldLoadRemoteProfile) {
    try {
      yield call(ProfileAsPromise, userId, version, type)
    } catch (e: any) {
      trackEvent('error_fatal', {
        message: `error loading profile ${userId}:${version}: ` + e.message,
        context: 'kernel#saga',
        stack: e.stack || e.stacktrace
      })
    }
  }
}
