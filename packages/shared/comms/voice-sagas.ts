import { call, select, takeEvery, takeLatest } from 'redux-saga/effects'
import { waitForRendererInstance } from 'shared/renderer/sagas'
import { isFeatureToggleEnabled } from 'shared/selectors'
import { SceneFeatureToggles } from 'shared/types'
import { sceneObservable } from 'shared/world/sceneState'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
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
  VoiceRecordingUpdate,
  VOICE_PLAYING_UPDATE,
  VOICE_RECORDING_UPDATE
} from './actions'
import { CommsContext, commsLogger } from './context'
import {
  isVoiceChatRecording,
  getVoiceCommunicator,
  isVoiceChatAllowedByCurrentScene,
  getCommsContext
} from './selectors'
import { initVoiceCommunicator } from './voice-over-comms'

export function* voiceSaga() {
  yield call(initVoiceCommunicator)

  yield call(listenToWhetherSceneSupportsVoiceChat)

  yield takeLatest(SET_VOICE_CHAT_RECORDING, updateVoiceChatRecordingStatus)
  yield takeEvery(TOGGLE_VOICE_CHAT_RECORDING, updateVoiceChatRecordingStatus)
  yield takeEvery(VOICE_PLAYING_UPDATE, updateUserVoicePlaying)
  yield takeEvery(VOICE_RECORDING_UPDATE, updatePlayerVoiceRecording)
  yield takeEvery(SET_VOICE_VOLUME, updateVoiceChatVolume)
  yield takeEvery(SET_VOICE_MUTE, updateVoiceChatMute)
}

function* listenToWhetherSceneSupportsVoiceChat() {
  sceneObservable.add(({ newScene }) => {
    const nowEnabled = newScene
      ? isFeatureToggleEnabled(SceneFeatureToggles.VOICE_CHAT, newScene.sceneJsonData)
      : isFeatureToggleEnabled(SceneFeatureToggles.VOICE_CHAT)

    getUnityInstance().SetVoiceChatEnabledByScene(nowEnabled)
  })
}

function* updateVoiceChatRecordingStatus() {
  const recording = yield select(isVoiceChatRecording)
  const voiceCommunicator: VoiceCommunicator = yield select(getVoiceCommunicator)

  if (!isVoiceChatAllowedByCurrentScene() || !recording) {
    voiceCommunicator.pause()
  } else {
    yield call(requestUserMedia)
    voiceCommunicator.start()
  }
}

// TODO: bind this function to a "Request Microphone" button
function* requestUserMedia() {
  const voiceCommunicator: VoiceCommunicator = yield select(getVoiceCommunicator)
  if (!voiceCommunicator.hasInput()) {
    const media = yield call(requestMediaDevice)
    if (media) {
      yield voiceCommunicator.setInputStream(media)
    }
  }
}

function* updateUserVoicePlaying(action: VoicePlayingUpdate) {
  const { userId, playing } = action.payload
  const commsContext: CommsContext | undefined = yield select(getCommsContext)
  if (commsContext) {
    for (const peerInfo of commsContext.peerData.values()) {
      if (peerInfo.identity === userId) {
        peerInfo.talking = playing
        break
      }
    }
  }
  getUnityInstance().SetUserTalking(userId, playing)
}

function* updatePlayerVoiceRecording(action: VoiceRecordingUpdate) {
  yield call(waitForRendererInstance)
  getUnityInstance().SetPlayerTalking(action.payload.recording)
}

function* updateVoiceChatVolume(action: SetVoiceVolume) {
  const voiceCommunicator: VoiceCommunicator = yield select(getVoiceCommunicator)
  voiceCommunicator.setVolume(action.payload.volume)
}

function* updateVoiceChatMute(action: SetVoiceMute) {
  const voiceCommunicator: VoiceCommunicator = yield select(getVoiceCommunicator)
  voiceCommunicator.setMute(action.payload.mute)
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
