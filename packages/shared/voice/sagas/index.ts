import { all, put, select, takeEvery } from 'redux-saga/effects'
import { voiceSaga as defaultSaga } from '@dcl/voice/dist/sagas'
import { VoiceState } from '@dcl/voice/dist/types'
import { joinRoom, startVoice } from '@dcl/voice/dist/actions'
import { getRoomId } from '@dcl/voice/dist/selectors'

import { SET_COMMS_ISLAND, SetCommsIsland } from '../../comms/actions'
import { USER_AUTHENTIFIED, UserAuthentified } from '../../session/actions'

export function* voiceSaga() {
  yield all([sagas(), defaultSaga()])
}

export function* sagas() {
  yield takeEvery(USER_AUTHENTIFIED, userAuthentified)
  yield takeEvery(SET_COMMS_ISLAND, changeIsland)
}

// TODO: remove constants
const ONE_MIMNUTE = 1000 * 60
const URL = 'wss://test-sfu.decentraland.zone/ws'

function* userAuthentified(action: UserAuthentified) {
  // TODO: This should be an env var.
  const config: VoiceState['config'] = {
    url: URL,
    userAddress: action.payload.identity.address,
    retryTimes: 10,
    pingInterval: ONE_MIMNUTE
  }

  yield put(startVoice(config))
}

function* changeIsland(action: SetCommsIsland) {
  // TODO:
  // When u jump and see the loading scene page we need to leave the room
  const roomId: ReturnType<typeof getRoomId> = yield select(getRoomId)
  const { island } = action.payload

  if (!island || island === roomId) {
    return
  }

  yield put(joinRoom(island))
}
