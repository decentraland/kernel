import { call, select, takeEvery, takeLatest, put } from 'redux-saga/effects'
import { receiveUserTalking } from 'shared/comms/peers'
import { getCommsContext } from 'shared/comms/selectors'
import { VOICE_CHAT_SAMPLE_RATE } from 'voice-chat-codec/constants'
import { createOpusVoiceHandler } from 'voice-chat-codec/opusVoiceHandler'
import { VoiceHandler } from 'voice-chat-codec/VoiceChat'
import {
  JOIN_VOICE_CHAT,
  LEAVE_VOICE_CHAT,
  SET_VOICE_CHAT_MUTE,
  SET_VOICE_CHAT_VOLUME,
  VOICE_PLAYING_UPDATE,
  REQUEST_VOICE_CHAT_RECORDING,
  REQUEST_TOGGLE_VOICE_CHAT_RECORDING,
  VoicePlayingUpdate,
  SetVoiceChatVolume,
  SetVoiceChatMute,
  setVoiceChatHandler
} from './actions'
import { voiceChatLogger } from './context'

import { isVoiceChatRecording, getVoiceHandler, isVoiceChatAllowedByCurrentScene } from './selectors'

export function* voiceChatSaga() {
  yield takeEvery(JOIN_VOICE_CHAT, handleJoinVoiceChat)
  yield takeEvery(LEAVE_VOICE_CHAT, handleLeaveVoiceChat)

  yield takeLatest(REQUEST_VOICE_CHAT_RECORDING, handleVoiceChatRecordingStatus)
  yield takeLatest(REQUEST_TOGGLE_VOICE_CHAT_RECORDING, handleVoiceChatRecordingStatus)

  yield takeEvery(VOICE_PLAYING_UPDATE, handleUserVoicePlaying)

  yield takeEvery(SET_VOICE_CHAT_VOLUME, handleVoiceChatVolume)
  yield takeEvery(SET_VOICE_CHAT_MUTE, handleVoiceChatMute)
}

function* handleVoiceChatRecordingStatus() {
  const recording = yield select(isVoiceChatRecording)
  const voiceHandler: VoiceHandler | undefined = yield select(getVoiceHandler)

  if (voiceHandler) {
    if (!isVoiceChatAllowedByCurrentScene() || !recording) {
      voiceHandler.setRecording(false)
    } else {
      yield call(requestUserMedia)
      voiceHandler.setRecording(true)
    }
  }
}

function* handleJoinVoiceChat() {
  voiceChatLogger.log('join voice chat')
  const commsContext = yield select(getCommsContext)
  if (commsContext) {
    const voiceHandler = createOpusVoiceHandler(commsContext.worldInstanceConnection)
    yield put(setVoiceChatHandler(voiceHandler))
  }
}

function* handleLeaveVoiceChat() {
  voiceChatLogger.log('leave voice chat')
}

// TODO: bind this function to a "Request Microphone" button
function* requestUserMedia() {
  const voiceHandler: VoiceHandler = yield select(getVoiceHandler)
  if (!voiceHandler.hasInput()) {
    const media = yield call(requestMediaDevice)
    if (media) {
      yield voiceHandler.setInputStream(media)
    }
  }
}

function* handleUserVoicePlaying(action: VoicePlayingUpdate) {
  const { userId, playing } = action.payload
  receiveUserTalking(userId, playing)
}

function* handleVoiceChatVolume(action: SetVoiceChatVolume) {
  const voiceHandler: VoiceHandler | undefined = yield select(getVoiceHandler)
  voiceHandler?.setVolume(action.payload.volume)
}

function* handleVoiceChatMute(action: SetVoiceChatMute) {
  const voiceHandler: VoiceHandler | undefined = yield select(getVoiceHandler)
  voiceHandler?.setMute(action.payload.mute)
}

let audioRequestPending = false

async function requestMediaDevice() {
  if (!audioRequestPending) {
    audioRequestPending = true

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: VOICE_CHAT_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          advanced: [{ echoCancellation: true }, { autoGainControl: true }, { noiseSuppression: true }] as any
        },
        video: false
      })

      return media
    } catch (e) {
      voiceChatLogger.log('Error requesting audio: ', e)
    } finally {
      audioRequestPending = false
    }
  }
}
