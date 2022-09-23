import { createLogger } from 'shared/logger'
import { HeartbeatMessage, IslandChangedMessage } from 'shared/protocol/kernel/comms/v3/archipelago.gen'
import { store } from 'shared/store/isolatedStore'
import { lastPlayerPositionReport } from 'shared/world/positionThings'
import {
  connectToComms,
  handleBffDisconnection,
  HandleBffDisconnection,
  HANDLE_BFF_DISCONNECTION,
  setBff,
  SET_BFF
} from './actions'
import { SET_COMMS_ISLAND } from '../comms/actions'
import { listenSystemMessage } from '../comms/logic/subscription-adapter'
import { IBff } from './types'
import { Reader } from 'protobufjs/minimal'
import { call, delay, fork, put, race, select, take, takeEvery } from 'redux-saga/effects'
import { DEPLOY_PROFILE_SUCCESS } from 'shared/profiles/actions'
import { getBff } from './selectors'
import { getCurrentIdentity } from 'shared/session/selectors'
import { ExplorerIdentity } from 'shared/session/types'
import { FATAL_ERROR } from 'shared/loading/types'
import { BEFORE_UNLOAD } from 'shared/protocol/actions'

const logger = createLogger('BffSagas')

export function* bffSaga() {
  yield fork(handleNewBFF)
  yield fork(handleHeartBeat)
  yield takeEvery(HANDLE_BFF_DISCONNECTION, handleBffDisconnectionSaga)

  yield takeEvery(FATAL_ERROR, function* () {
    yield put(setBff(undefined))
  })

  yield takeEvery(BEFORE_UNLOAD, function* () {
    yield put(setBff(undefined))
  })
}

/**
 * This function binds the given IBff to the kernel and returns the "unbind"
 * function in charge of disconnecting it from kernel.
 */
async function bindHandlersToBFF(bff: IBff, address: string): Promise<() => Promise<void>> {
  bff.events.on('DISCONNECTION', () => {
    store.dispatch(handleBffDisconnection(bff))
  })

  bff.events.on('setIsland', (message) => {
    logger.log('Island message', message)
    store.dispatch(connectToComms(message))
  })

  const islandListener = listenSystemMessage(bff.services.comms, `${address}.island_changed`, async (message) => {
    try {
      const islandChangedMessage = IslandChangedMessage.decode(Reader.create(message.payload))
      bff.events.emit('setIsland', islandChangedMessage)
    } catch (e) {
      logger.error('cannot process island change message', e)
      return
    }
  })

  return async function unbind(): Promise<void> {
    bff.events.off('DISCONNECTION')

    await islandListener.close()

    try {
      await bff.disconnect()
    } catch (err: any) {
      // this only needs to be logged. try {} catch is used because the function needs
      // to wait for the disconnection to continue with the saga.
      logger.error(err)
    }
  }
}

// this function is called from the handleHeartbeat saga
async function sendHeartBeat(bff: IBff) {
  if (lastPlayerPositionReport) {
    const { x, y, z } = lastPlayerPositionReport.position
    const position = [x, y, z]
    const payload = HeartbeatMessage.encode({
      position: {
        x: position[0],
        y: position[1],
        z: position[2]
      }
    }).finish()
    try {
      await bff.services.comms.publishToTopic({
        topic: 'heartbeat',
        payload
      })
    } catch (err: any) {
      await bff.disconnect(err)
    }
  }
}

/**
 * this saga handles the heartbeats of Archipelago via IBff
 */
function* handleHeartBeat() {
  while (true) {
    yield race({
      SET_BFF: take(SET_BFF),
      SET_COMMS_ISLAND: take(SET_COMMS_ISLAND),
      DEPLOY_PROFILE_SUCCESS: take(DEPLOY_PROFILE_SUCCESS),
      delay: delay(2500)
    })

    const bff: IBff | undefined = yield select(getBff)

    if (bff) {
      yield call(sendHeartBeat, bff)
    }
  }
}

// this saga reacts to changes in BFF context
function* handleNewBFF() {
  let currentBff: IBff | undefined = undefined
  let unbind: () => Promise<void> = async function () {}

  yield takeEvery(SET_BFF, function* () {
    const oldBff = currentBff
    currentBff = yield select(getBff)

    if (oldBff && oldBff !== currentBff && unbind) {
      // disconnect previous bff
      yield call(unbind)
    }

    if (currentBff && oldBff !== currentBff) {
      const identity: ExplorerIdentity = yield select(getCurrentIdentity)
      // bind messages to this comms instance
      unbind = yield call(bindHandlersToBFF, currentBff, identity?.address)
    }
  })
}

// this saga handles the suddenly disconnection of a IBff
function* handleBffDisconnectionSaga(action: HandleBffDisconnection) {
  const context: IBff = yield select(getBff)

  if (context && context === action.payload.context) {
    // this also remove the context
    yield put(setBff(undefined))
  }
}
