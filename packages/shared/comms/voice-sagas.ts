import { call, select, takeEvery, takeLatest } from 'redux-saga/effects'
import defaultLogger from 'shared/logger'
import { VoiceCommunicator } from 'voice-chat-codec/VoiceCommunicator'
import {
  VoicePlayingUpdate,
  SetVoiceVolume,
  SetVoiceMute,
  SET_VOICE_CHAT_RECORDING,
  SET_VOICE_MUTE,
  SET_VOICE_VOLUME,
  TOGGLE_VOICE_CHAT_RECORDING,
  VOICE_PLAYING_UPDATE
} from './actions'
import { receiveUserTalking } from './peers'
import { isVoiceChatRecording, getVoiceCommunicator, isVoiceChatAllowedByCurrentScene } from './selectors'
import { initVoiceCommunicator } from './voice-over-comms'

export function* voiceSaga() {
  yield call(initVoiceCommunicator)

  yield takeLatest(SET_VOICE_CHAT_RECORDING, updateVoiceChatRecordingStatus)
  yield takeEvery(TOGGLE_VOICE_CHAT_RECORDING, updateVoiceChatRecordingStatus)
  yield takeEvery(VOICE_PLAYING_UPDATE, updateUserVoicePlaying)
  yield takeEvery(SET_VOICE_VOLUME, updateVoiceChatVolume)
  yield takeEvery(SET_VOICE_MUTE, updateVoiceChatMute)
}

function* updateVoiceChatRecordingStatus() {
  const recording = yield select(isVoiceChatRecording)
  const voiceCommunicator: VoiceCommunicator = yield select(getVoiceCommunicator)

  if (!isVoiceChatAllowedByCurrentScene() || !recording) {
    voiceCommunicator.pause()
  } else {
    voiceCommunicator.start()
  }
}

function* updateUserVoicePlaying(action: VoicePlayingUpdate) {
  const { userId, playing } = action.payload

  receiveUserTalking(userId, playing)
}

function* updateVoiceChatVolume(action: SetVoiceVolume) {
  defaultLogger.log('updateVoiceChatVolume', action)
}

function* updateVoiceChatMute(action: SetVoiceMute) {
  defaultLogger.log('updateVoiceChatMute', action)
}
