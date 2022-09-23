import { put, takeEvery, select, call, takeLatest, fork, take, race, delay, apply } from 'redux-saga/effects'

import { commsEstablished, establishingComms, FATAL_ERROR } from 'shared/loading/types'
import { CommsContext, commsLogger } from './context'
import { getCommsContext } from './selectors'
import { BEFORE_UNLOAD } from 'shared/protocol/actions'
import {
  HandleCommsDisconnection,
  HANDLE_COMMS_DISCONNECTION,
  setCommsIsland,
  setWorldContext,
  SET_COMMS_ISLAND,
  SET_WORLD_CONTEXT
} from './actions'
import { notifyStatusThroughChat } from 'shared/chat'
import { bindHandlersToCommsContext, createSendMyProfileOverCommsChannel } from './handlers'
import { Rfc4RoomConnection } from './logic/rfc-4-room-connection'
import { DEPLOY_PROFILE_SUCCESS, SEND_PROFILE_TO_RENDERER } from 'shared/profiles/actions'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { Avatar, IPFSv2, Snapshots } from '@dcl/schemas'
import { commConfigurations, DEBUG_COMMS, genericAvatarSnapshots, PREFERED_ISLAND } from 'config'
import { isURL } from 'atomicHelpers/isURL'
import { processAvatarVisibility } from './peers'
import { getFatalError } from 'shared/loading/selectors'
import { EventChannel } from 'redux-saga'
import { ExplorerIdentity } from 'shared/session/types'
import { getIdentity } from 'shared/session'
import { USER_AUTHENTIFIED } from 'shared/session/actions'
import * as rfc4 from 'shared/protocol/kernel/comms/comms-rfc-4.gen'
import { selectAndReconnectRealm } from 'shared/dao/sagas'
import { realmToConnectionString } from '../bff/resolver'
import { waitForMetaConfigurationInitialization } from 'shared/meta/sagas'
import { getCommsConfig, getMaxVisiblePeers } from 'shared/meta/selectors'
import { getCurrentIdentity } from 'shared/session/selectors'
import { OfflineAdapter } from './adapters/OfflineAdapter'
import { WebSocketAdapter } from './adapters/WebSocketAdapter'
import { LivekitAdapter } from './adapters/LivekitAdapter'
import { PeerToPeerAdapter } from './adapters/PeerToPeerAdapter'
import { MinimumCommunicationsAdapter } from './adapters/types'
import { Position3D } from './v3/types'
import { IBff } from 'shared/bff/types'
import { CommsConfig } from 'shared/meta/types'
import { Authenticator } from '@dcl/crypto'
import { LighthouseConnectionConfig, LighthouseWorldInstanceConnection } from './v2/LighthouseWorldInstanceConnection'
import { lastPlayerPositionReport } from 'shared/world/positionThings'
import { store } from 'shared/store/isolatedStore'
import { ProfileType } from 'shared/profiles/types'
import { ConnectToCommsAction, CONNECT_TO_COMMS } from 'shared/bff/actions'
import { getBff, getRealm } from 'shared/bff/selectors'

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

  yield takeEvery(CONNECT_TO_COMMS, handleConnectToComms)

  yield fork(handleNewCommsContext)

  // respond to profile requests over comms
  yield fork(respondCommsProfileRequests)

  yield fork(handleAnnounceProfile)
  yield fork(initAvatarVisibilityProcess)
  yield fork(handleCommsReconnectionInterval)
}

/**
 * This saga handles the action to connect a specific comms
 * adapter.
 */
function* handleConnectToComms(action: ConnectToCommsAction) {
  const identity: ExplorerIdentity = yield select(getCurrentIdentity)

  const [protocol, url] = action.payload.event.connStr.split(':', 2)

  let adapter: MinimumCommunicationsAdapter | undefined = undefined

  switch (protocol) {
    case 'offline': {
      adapter = new OfflineAdapter()
      break
    }
    case 'ws-room': {
      adapter = new WebSocketAdapter(url, identity)
      break
    }
    case 'livekit': {
      const theUrl = new URL(url)
      const token = theUrl.searchParams.get('access_token')
      if (!token) {
        throw new Error('No access token')
      }
      adapter = new LivekitAdapter({
        logger: commsLogger,
        url,
        token
      })
      break
    }
    case 'p2p': {
      adapter = yield call(createP2PAdapter, action.payload.event.islandId)
      break
    }
    case 'lighthouse': {
      adapter = yield call(createLighthouseConnection, url)
      break
    }
  }

  if (!adapter) throw new Error(`A communications adapter could not be created for protocol=${protocol}`)

  const commsContext = new CommsContext(
    identity.address,
    identity.hasConnectedWeb3 ? ProfileType.DEPLOYED : ProfileType.LOCAL,
    new Rfc4RoomConnection(adapter)
  )

  yield put(establishingComms())

  if (yield commsContext.connect()) {
    yield put(setWorldContext(commsContext))
  }
}

function* createP2PAdapter(islandId: string) {
  const identity: ExplorerIdentity = yield select(getCurrentIdentity)
  const bff: IBff = yield select(getBff)
  if (!bff) throw new Error('p2p transport requires a valid bff')
  const peers = new Map<string, Position3D>()
  const commsConfig: CommsConfig = yield select(getCommsConfig)
  // for (const [id, p] of Object.entries(islandChangedMessage.peers)) {
  //   if (peerId !== id) {
  //     peers.set(id, [p.x, p.y, p.z])
  //   }
  // }
  return new PeerToPeerAdapter(
    {
      logger: commsLogger,
      bff,
      logConfig: {
        debugWebRtcEnabled: !!DEBUG_COMMS,
        debugUpdateNetwork: !!DEBUG_COMMS,
        debugIceCandidates: !!DEBUG_COMMS,
        debugMesh: !!DEBUG_COMMS
      },
      relaySuspensionConfig: {
        relaySuspensionInterval: commsConfig.relaySuspensionInterval ?? 750,
        relaySuspensionDuration: commsConfig.relaySuspensionDuration ?? 5000
      },
      islandId,
      // TODO: is this peerId correct?
      peerId: identity.address
    },
    peers
  )
}
function* createLighthouseConnection(url: string) {
  const commsConfig: CommsConfig = yield select(getCommsConfig)
  const identity: ExplorerIdentity = yield select(getCurrentIdentity)
  const peerConfig: LighthouseConnectionConfig = {
    connectionConfig: {
      iceServers: commConfigurations.defaultIceServers
    },
    authHandler: async (msg: string) => {
      try {
        return Authenticator.signPayload(identity, msg)
      } catch (e) {
        commsLogger.info(`error while trying to sign message from lighthouse '${msg}'`)
      }
      // if any error occurs
      return getIdentity()
    },
    logLevel: DEBUG_COMMS ? 'TRACE' : 'NONE',
    targetConnections: commsConfig.targetConnections ?? 4,
    maxConnections: commsConfig.maxConnections ?? 6,
    positionConfig: {
      selfPosition: () => {
        if (lastPlayerPositionReport) {
          const { x, y, z } = lastPlayerPositionReport.position
          return [x, y, z]
        }
      },
      maxConnectionDistance: 4,
      nearbyPeersDistance: 5,
      disconnectDistance: 5
    },
    preferedIslandId: PREFERED_ISLAND ?? ''
  }

  if (!commsConfig.relaySuspensionDisabled) {
    peerConfig.relaySuspensionConfig = {
      relaySuspensionInterval: commsConfig.relaySuspensionInterval ?? 750,
      relaySuspensionDuration: commsConfig.relaySuspensionDuration ?? 5000
    }
  }

  const lighthouse = new LighthouseWorldInstanceConnection(
    url,
    peerConfig,
    (status) => {
      commsLogger.log('Lighthouse status: ', status)
      switch (status.status) {
        case 'realm-full':
        case 'reconnection-error':
        case 'id-taken':
          lighthouse.disconnect().catch(commsLogger.error)
          break
      }
    },
    identity
  )

  lighthouse.onIslandChangedObservable.add(({ island }) => {
    store.dispatch(setCommsIsland(island))
  })

  return lighthouse
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

    if (profile && context?.worldInstanceConnection) {
      profile.hasConnectedWeb3 = identity?.hasConnectedWeb3 || profile.hasConnectedWeb3

      // naive throttling
      const now = Date.now()
      const elapsed = now - lastMessage
      if (elapsed < TIME_BETWEEN_PROFILE_RESPONSES) continue
      lastMessage = now

      const connection = context.worldInstanceConnection
      const response: rfc4.ProfileResponse = {
        serializedProfile: JSON.stringify(stripSnapshots(profile))
      }
      yield apply(connection, connection.sendProfileResponse, [response])
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
      // notifyStatusThroughChat(`Welcome to realm ${realmToConnectionString(currentContext.realm)}!`)
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
