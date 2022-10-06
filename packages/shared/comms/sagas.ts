import { put, takeEvery, select, call, takeLatest, fork, take, race, delay, apply } from 'redux-saga/effects'

import { commsEstablished, establishingComms, FATAL_ERROR } from 'shared/loading/types'
import { commsLogger } from './context'
import { getCommsRoom } from './selectors'
import { BEFORE_UNLOAD } from 'shared/actions'
import {
  HandleRoomDisconnection,
  HANDLE_ROOM_DISCONNECTION,
  setCommsIsland,
  setRoomConnection,
  SET_COMMS_ISLAND,
  SET_WORLD_CONTEXT
} from './actions'
import { notifyStatusThroughChat } from 'shared/chat'
import { bindHandlersToCommsContext, createSendMyProfileOverCommsChannel } from './handlers'
import { Rfc4RoomConnection } from './logic/rfc-4-room-connection'
import { DEPLOY_PROFILE_SUCCESS, SEND_PROFILE_TO_RENDERER } from 'shared/profiles/actions'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { Avatar, IPFSv2, Snapshots } from '@dcl/schemas'
import { commConfigurations, COMMS_GRAPH, DEBUG_COMMS, genericAvatarSnapshots, PREFERED_ISLAND } from 'config'
import { isURL } from 'atomicHelpers/isURL'
import { processAvatarVisibility } from './peers'
import { getFatalError } from 'shared/loading/selectors'
import { EventChannel } from 'redux-saga'
import { ExplorerIdentity } from 'shared/session/types'
import { getIdentity } from 'shared/session'
import { USER_AUTHENTIFIED } from 'shared/session/actions'
import * as rfc4 from 'shared/protocol/kernel/comms/comms-rfc-4.gen'
import { selectAndReconnectRealm } from 'shared/dao/sagas'
import { waitForMetaConfigurationInitialization } from 'shared/meta/sagas'
import { getCommsConfig, getMaxVisiblePeers } from 'shared/meta/selectors'
import { getCurrentIdentity } from 'shared/session/selectors'
import { OfflineAdapter } from './adapters/OfflineAdapter'
import { WebSocketAdapter } from './adapters/WebSocketAdapter'
import { LivekitAdapter } from './adapters/LivekitAdapter'
import { PeerToPeerAdapter } from './adapters/PeerToPeerAdapter'
import { SimulationRoom } from './adapters/SimulatorAdapter'
import { Position3D } from './v3/types'
import { IBff } from 'shared/bff/types'
import { CommsConfig } from 'shared/meta/types'
import { Authenticator } from '@dcl/crypto'
import { LighthouseConnectionConfig, LighthouseWorldInstanceConnection } from './v2/LighthouseWorldInstanceConnection'
import { lastPlayerPositionReport, positionObservable, PositionReport } from 'shared/world/positionThings'
import { store } from 'shared/store/isolatedStore'
import { ConnectToCommsAction, CONNECT_TO_COMMS, setBff, SET_BFF } from 'shared/bff/actions'
import { getBff, getFetchContentUrlPrefixFromBff, waitForBff } from 'shared/bff/selectors'
import { positionReportToCommsPositionRfc4 } from './interface/utils'
import { deepEqual } from 'atomicHelpers/deepEqual'
import { incrementCounter } from 'shared/occurences'
import { RoomConnection } from './interface'
import { debugCommsGraph } from 'shared/session/getPerformanceInfo'

const TIME_BETWEEN_PROFILE_RESPONSES = 1000
const INTERVAL_ANNOUNCE_PROFILE = 1000

export function* commsSaga() {
  yield takeLatest(HANDLE_ROOM_DISCONNECTION, handleRoomDisconnectionSaga)

  yield takeEvery(FATAL_ERROR, function* () {
    // set null context on fatal error. this will bring down comms.
    yield put(setRoomConnection(undefined))
  })

  yield takeEvery(BEFORE_UNLOAD, function* () {
    // this would disconnect the comms context
    yield put(setRoomConnection(undefined))
  })

  yield takeEvery(CONNECT_TO_COMMS, handleConnectToComms)

  yield fork(handleNewCommsContext)

  // respond to profile requests over comms
  yield fork(respondCommsProfileRequests)

  yield fork(handleAnnounceProfile)
  yield fork(initAvatarVisibilityProcess)
  yield fork(handleCommsReconnectionInterval)

  yield fork(reportPositionSaga)

  if (COMMS_GRAPH) {
    yield call(debugCommsGraph)
  }
}

/**
 * This saga reports the position of our player:
 * - once every one second
 * - or when a new comms context is set
 * - and every time a positionObservable is called with a maximum of 10Hz
 */
function* reportPositionSaga() {
  let latestRoom: RoomConnection | undefined = undefined

  let lastNetworkUpdatePosition = 0
  let lastPositionSent: rfc4.Position

  const observer = positionObservable.add((obj: Readonly<PositionReport>) => {
    if (latestRoom) {
      const newPosition = positionReportToCommsPositionRfc4(obj)
      const now = Date.now()
      const elapsed = now - lastNetworkUpdatePosition

      // We only send the same position message as a ping if we have not sent positions in the last 1 second
      if (elapsed < 1000) {
        if (deepEqual(newPosition, lastPositionSent)) {
          return
        }
      }

      // Otherwise we simply respect the 10Hz
      if (elapsed > 100) {
        lastPositionSent = newPosition
        lastNetworkUpdatePosition = now
        latestRoom.sendPositionMessage(newPosition).catch((e) => {
          incrementCounter('failed:sendPositionMessage')
          commsLogger.warn(`error while sending message `, e)
        })
      }
    }
  })

  while (true) {
    const reason = yield race({
      UNLOAD: take(BEFORE_UNLOAD),
      ERROR: take(FATAL_ERROR),
      timeout: delay(1000),
      setNewContext: take(SET_WORLD_CONTEXT)
    })

    if (reason.UNLOAD || reason.ERROR) break

    if (!latestRoom) lastNetworkUpdatePosition = 0
    latestRoom = yield select(getCommsRoom)

    if (latestRoom && lastPlayerPositionReport) {
      latestRoom
        .sendPositionMessage(positionReportToCommsPositionRfc4(lastPlayerPositionReport))
        .catch(commsLogger.error)
    }
  }

  positionObservable.remove(observer)
}

/**
 * This saga handles the action to connect a specific comms
 * adapter.
 */
function* handleConnectToComms(action: ConnectToCommsAction) {
  try {
    const identity: ExplorerIdentity = yield select(getCurrentIdentity)

    const ix = action.payload.event.connStr.indexOf(':')
    const protocol = action.payload.event.connStr.substring(0, ix)
    const url = action.payload.event.connStr.substring(ix + 1)

    console.log('HANDLE CONNECT TO COMMS', action.payload.event.islandId)
    yield put(setCommsIsland(action.payload.event.islandId))

    let adapter: RoomConnection | undefined = undefined

    switch (protocol) {
      case 'offline': {
        adapter = new Rfc4RoomConnection(new OfflineAdapter())
        break
      }
      case 'ws-room': {
        const finalUrl = !url.startsWith('ws:') && !url.startsWith('wss:') ? 'wss://' + url : url

        adapter = new Rfc4RoomConnection(new WebSocketAdapter(finalUrl, identity))
        break
      }
      case 'simulator': {
        adapter = new SimulationRoom(url)
        break
      }
      case 'livekit': {
        const theUrl = new URL(url)
        const token = theUrl.searchParams.get('access_token')
        if (!token) {
          throw new Error('No access token')
        }
        adapter = new Rfc4RoomConnection(
          new LivekitAdapter({
            logger: commsLogger,
            url,
            token
          })
        )
        break
      }
      case 'p2p': {
        adapter = new Rfc4RoomConnection(yield call(createP2PAdapter, action.payload.event.islandId))
        break
      }
      case 'lighthouse': {
        adapter = yield call(createLighthouseConnection, url)
        break
      }
    }

    if (!adapter) throw new Error(`A communications adapter could not be created for protocol=${protocol}`)

    globalThis.__DEBUG_ADAPTER = adapter

    yield put(establishingComms())
    yield apply(adapter, adapter.connect, [])
    console.log('SET ROOM CONNECTION')
    yield put(setRoomConnection(adapter))
  } catch (error: any) {
    notifyStatusThroughChat('Error connecting to comms. Will try another realm')
    yield put(setBff(undefined))
    yield put(setRoomConnection(undefined))
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
          lighthouse.disconnect({ kicked: true, error: new Error(status.status) }).catch(commsLogger.error)
          break
      }
    },
    identity
  )

  lighthouse.onIslandChangedObservable.add(({ island }) => {
    console.log('ON CHANGE', island)
    store.dispatch(setCommsIsland(island))
  })

  return lighthouse
}

/**
 * This saga runs every 100ms and checks the visibility of all avatars, hiding
 * to the avatar scene the ones that are far away
 */
function* initAvatarVisibilityProcess() {
  yield call(waitForMetaConfigurationInitialization)
  const maxVisiblePeers = yield select(getMaxVisiblePeers)

  while (true) {
    const reason = yield race({
      delay: delay(100),
      unload: take(BEFORE_UNLOAD)
    })

    if (reason.unload) break

    const account: ExplorerIdentity | undefined = yield select(getIdentity)

    processAvatarVisibility(maxVisiblePeers, account?.address)
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

    const context = (yield select(getCommsRoom)) as RoomConnection | undefined
    const profile: Avatar | null = yield select(getCurrentUserProfile)
    const bff: IBff = yield call(waitForBff)
    const contentServer: string = getFetchContentUrlPrefixFromBff(bff)
    const identity: ExplorerIdentity | null = yield select(getIdentity)

    if (profile && context) {
      profile.hasConnectedWeb3 = identity?.hasConnectedWeb3 || profile.hasConnectedWeb3

      // naive throttling
      const now = Date.now()
      const elapsed = now - lastMessage
      if (elapsed < TIME_BETWEEN_PROFILE_RESPONSES) continue
      lastMessage = now

      const response: rfc4.ProfileResponse = {
        serializedProfile: JSON.stringify(stripSnapshots(profile)),
        baseUrl: contentServer
      }
      yield apply(context, context.sendProfileResponse, [response])
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
      SET_BFF: take(SET_BFF),
      USER_AUTHENTIFIED: take(USER_AUTHENTIFIED),
      timeout: delay(1000)
    })

    const coomConnection: RoomConnection | undefined = yield select(getCommsRoom)
    const bff: IBff | undefined = yield select(getBff)
    const hasFatalError: string | undefined = yield select(getFatalError)
    const identity: ExplorerIdentity | undefined = yield select(getIdentity)

    const shouldReconnect = !coomConnection && !hasFatalError && identity?.address && !bff

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

    const roomConnection: RoomConnection | undefined = yield select(getCommsRoom)
    const profile: Avatar | null = yield select(getCurrentUserProfile)

    if (roomConnection && profile) {
      roomConnection.sendProfileMessage({ profileVersion: profile.version }).catch(commsLogger.error)
    }
  }
}

// this saga reacts to changes in context and disconnects the old context
function* handleNewCommsContext() {
  let roomConnection: RoomConnection | undefined = undefined

  yield takeEvery(SET_WORLD_CONTEXT, function* () {
    const oldContext = roomConnection
    roomConnection = yield select(getCommsRoom)

    if (oldContext !== roomConnection) {
      if (roomConnection) {
        // bind messages to this comms instance
        yield call(bindHandlersToCommsContext, roomConnection)
        yield put(commsEstablished())
        console.log('Comms context connected')
      }

      if (oldContext) {
        // disconnect previous context
        yield call(disconnectRoom, oldContext)
      }
    }
  })
}

async function disconnectRoom(context: RoomConnection) {
  try {
    await context.disconnect()
  } catch (err: any) {
    // this only needs to be logged. try {} catch is used because the function needs
    // to wait for the disconnection to continue with the saga.
    commsLogger.error(err)
  }
}

// this saga handles the suddenly disconnection of a CommsContext
function* handleRoomDisconnectionSaga(action: HandleRoomDisconnection) {
  const room: RoomConnection = yield select(getCommsRoom)

  if (room && room === action.payload.context) {
    // this also remove the context
    yield put(setRoomConnection(undefined))

    if (action.payload.context) {
      notifyStatusThroughChat(`Lost connection to realm`)
    }
  }
}
