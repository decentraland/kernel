import { call, select, takeEvery, takeLatest } from 'redux-saga/effects'
import { VOICE_CHAT_SAMPLE_RATE } from 'voice-chat-codec/constants'
import { VoiceCommunicator } from 'voice-chat-codec/VoiceCommunicator'
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
import { isVoiceChatRecording, getVoiceCommunicator, isVoiceChatAllowedByCurrentScene } from './selectors'
import { initializeVoiceChat, destroyVoiceChat } from './voice-over-comms'

export function* voiceSaga() {
  yield call(initializeVoiceChat)
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
  const voiceCommunicator: VoiceCommunicator | null = yield select(getVoiceCommunicator)
  if (!voiceCommunicator) return

  if (!isVoiceChatAllowedByCurrentScene() || !recording) {
    voiceCommunicator.pause()
  } else {
    yield call(requestUserMedia)
    voiceCommunicator.start()
  }
}

// TODO: bind this function to a "Request Microphone" button
function* requestUserMedia() {
  const voiceCommunicator: VoiceCommunicator | null = yield select(getVoiceCommunicator)
  if (voiceCommunicator) {
    if (!voiceCommunicator.hasInput()) {
      const media = yield call(requestMediaDevice)
      if (media) {
        yield voiceCommunicator.setInputStream(media)
      }
    }
  }
}

function* updateUserVoicePlaying(action: VoicePlayingUpdate) {
  const { userId, playing } = action.payload

  receiveUserTalking(userId, playing)
}

function* updateVoiceChatVolume(action: SetVoiceVolume) {
  const voiceCommunicator: VoiceCommunicator | null = yield select(getVoiceCommunicator)
  voiceCommunicator?.setVolume(action.payload.volume)
}

function* updateVoiceChatMute(action: SetVoiceMute) {
  const voiceCommunicator: VoiceCommunicator | null = yield select(getVoiceCommunicator)
  voiceCommunicator?.setMute(action.payload.mute)
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
    } catch (e: any) {
      commsLogger.log('Error requesting audio: ', e)
    } finally {
      audioRequestPending = false
    }
  }
}
