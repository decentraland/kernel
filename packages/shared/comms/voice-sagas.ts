import { call, select, takeEvery, takeLatest } from 'redux-saga/effects'
import { VOICE_CHAT_SAMPLE_RATE } from 'voice-chat-codec/opus/constants'
import { VoiceChat } from 'voice-chat-codec/VoiceChat'
import {
  VoicePlayingUpdate,
  SetVoiceVolume,
  SetVoiceMute,
  SET_VOICE_CHAT_RECORDING,
  SET_VOICE_MUTE,
  SET_VOICE_VOLUME,
  TOGGLE_VOICE_CHAT_RECORDING,
  VOICE_PLAYING_UPDATE,
  JOIN_VOICE_CHAT,
  LEAVE_VOICE_CHAT
} from './actions'
import { commsLogger } from './context'
import { receiveUserTalking } from './peers'
import { isVoiceChatRecording, getVoiceChat, isVoiceChatAllowedByCurrentScene } from './selectors'
import { initializeVoiceChat, destroyVoiceChat } from './voice-over-comms'

export function* voiceSaga() {
  yield takeEvery(JOIN_VOICE_CHAT, initializeVoiceChat)
  yield takeEvery(LEAVE_VOICE_CHAT, destroyVoiceChat)

  yield takeLatest(SET_VOICE_CHAT_RECORDING, updateVoiceChatRecordingStatus)
  yield takeEvery(TOGGLE_VOICE_CHAT_RECORDING, updateVoiceChatRecordingStatus)
  yield takeEvery(VOICE_PLAYING_UPDATE, updateUserVoicePlaying)
  yield takeEvery(SET_VOICE_VOLUME, updateVoiceChatVolume)
  yield takeEvery(SET_VOICE_MUTE, updateVoiceChatMute)
}

function* updateVoiceChatRecordingStatus() {
  const recording = yield select(isVoiceChatRecording)
  const voiceChat: VoiceChat = yield select(getVoiceChat)

  if (!isVoiceChatAllowedByCurrentScene() || !recording) {
    voiceChat.setRecording(false)
  } else {
    yield call(requestUserMedia)
    voiceChat.setRecording(true)
  }
}

// TODO: bind this function to a "Request Microphone" button
function* requestUserMedia() {
  const voiceChat: VoiceChat = yield select(getVoiceChat)
  if (!voiceChat.hasInput()) {
    const media = yield call(requestMediaDevice)
    if (media) {
      yield voiceChat.setInputStream(media)
    }
  }
}

function* updateUserVoicePlaying(action: VoicePlayingUpdate) {
  const { userId, playing } = action.payload

  receiveUserTalking(userId, playing)
}

function* updateVoiceChatVolume(action: SetVoiceVolume) {
  const voiceChat: VoiceChat = yield select(getVoiceChat)
  voiceChat.setVolume(action.payload.volume)
}

function* updateVoiceChatMute(action: SetVoiceMute) {
  const voiceChat: VoiceChat = yield select(getVoiceChat)
  voiceChat.setMute(action.payload.mute)
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
      commsLogger.log('Error requesting audio: ', e)
    } finally {
      audioRequestPending = false
    }
  }
}
