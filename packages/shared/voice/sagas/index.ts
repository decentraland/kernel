import { all, put, select, takeEvery } from 'redux-saga/effects'
import { voiceSaga as defaultSaga } from '@dcl/voice/dist/sagas'
import { VoiceState } from '@dcl/voice/dist/types'
import { joinRoom, startVoice } from '@dcl/voice/dist/actions'
import { getRoomId } from '@dcl/voice/dist/selectors'
import { getStreamByAddress } from '@dcl/voice/dist/utils'
import { udpateLocalPosition, updateStreamPosition } from '@dcl/voice/dist/position'

import { SET_COMMS_ISLAND, SetCommsIsland } from '../../comms/actions'
import { USER_AUTHENTIFIED, UserAuthentified } from '../../session/actions'
import { avatarMessageObservable, getUser } from '../../comms/peers'
import { AvatarMessageType } from '../../comms/interface/types'
import { getSpatialParamsFor } from '../../comms'
import { VoiceSpatialParams } from '../../../voice-chat-codec/VoiceCommunicator'

export function* voiceSaga() {
  takeStreamPositionsUpdate()
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

function takeStreamPositionsUpdate() {
  avatarMessageObservable.add((evt) => {
    if (evt.type === AvatarMessageType.USER_POSE) {
      const userId = getUser(evt.uuid)?.userId
      const stream = userId && getStreamByAddress(userId)

      if (!userId || !stream) return
      const { orientation, position } = getSpatialParamsFor(evt.pose)

      updateStreamPosition(
        stream,
        spatialToPositionVector(position),
        spatialToPositionVector(orientation)
      )
    }
  })
}

export function updateLocalStreamPosition(spatialParams: VoiceSpatialParams) {
  udpateLocalPosition(
    spatialToPositionVector(spatialParams.position),
    spatialToPositionVector(spatialParams.orientation)
  )
}

function spatialToPositionVector(position: [number, number, number]) {
  return {
    x: position[0],
    y: position[1],
    z: position[2]
  }
}
