import { put, takeEvery, select, call, takeLatest, fork } from 'redux-saga/effects'

import { commsEstablished, FATAL_ERROR } from 'shared/loading/types'
import { triggerReconnectRealm } from 'shared/dao/actions'
import { CommsContext, commsLogger } from './context'
import { getCommsContext, getRealm, sameRealm } from './selectors'
import { BEFORE_UNLOAD } from 'shared/protocol/actions'
import { voiceSaga } from './voice-sagas'
import { HandleCommsDisconnection, HANDLE_COMMS_DISCONNECTION, setWorldContext, SET_WORLD_CONTEXT } from './actions'
import { notifyStatusThroughChat } from 'shared/chat'
import { realmToConnectionString } from 'shared/dao/utils/realmToString'
import { bindHandlersToCommsContext } from './handlers'
import { RootCommsState } from './types'
import { Realm } from 'shared/dao/types'
import { Store } from 'redux'

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
}

// this saga reacts to changes in context and disconnects the old context
function* handleNewCommsContext() {
  let currentContext: CommsContext | undefined = undefined

  yield takeEvery(SET_WORLD_CONTEXT, function* () {
    const oldContext = currentContext
    currentContext = (yield select(getCommsContext)) as CommsContext | undefined

    if (currentContext) {
      yield call(bindHandlersToCommsContext, currentContext)
      yield put(commsEstablished())
      // connect new context
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

export function observeRealmChange(
  store: Store<RootCommsState>,
  onRealmChange: (previousRealm: Realm | undefined, currentRealm: Realm) => any
) {
  let currentRealm: Realm | undefined = getRealm(store.getState())
  store.subscribe(() => {
    const previousRealm = currentRealm
    currentRealm = getRealm(store.getState())
    if (currentRealm && (!previousRealm || !sameRealm(previousRealm, currentRealm))) {
      onRealmChange(previousRealm, currentRealm)
    }
  })
}
