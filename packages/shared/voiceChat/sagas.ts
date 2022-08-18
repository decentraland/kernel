import { call, select, takeEvery, takeLatest, put } from 'redux-saga/effects'
import { receiveUserTalking } from 'shared/comms/peers'
import { getCommsContext } from 'shared/comms/selectors'
import { VOICE_CHAT_SAMPLE_RATE } from 'voice-chat-codec/constants'
import { createOpusVoiceHandler } from 'voice-chat-codec/opusVoiceHandler'
import { VoiceHandler } from 'voice-chat-codec/VoiceChat'
import {
  LEAVE_VOICE_CHAT,
  SET_VOICE_CHAT_MUTE,
  SET_VOICE_CHAT_VOLUME,
  VOICE_PLAYING_UPDATE,
  REQUEST_VOICE_CHAT_RECORDING,
  REQUEST_TOGGLE_VOICE_CHAT_RECORDING,
  VoicePlayingUpdate,
  SetVoiceChatVolume,
  SetVoiceChatMute,
  setVoiceChatHandler,
  JOIN_LIVE_KIT_ROOM_VOICE_CHAT,
  JOIN_OPUS_VOICE_CHAT,
  voiceRecordingUpdate,
  voicePlayingUpdate,
  SET_VOICE_CHAT_HANDLER,
  SetVoiceChatHandlerAction
} from './actions'
import { voiceChatLogger } from './context'
import { store } from 'shared/store/isolatedStore'
import { isVoiceChatRecording, getVoiceHandler, isVoiceChatAllowedByCurrentScene } from './selectors'
import { positionObservable, PositionReport } from 'shared/world/positionThings'
import { positionReportToCommsPosition } from 'shared/comms/interface/utils'
import { getUnityInstance } from 'unity-interface/IUnityInterface'

export function* voiceChatSaga() {
  yield takeEvery(JOIN_LIVE_KIT_ROOM_VOICE_CHAT, handleJoinLiveKitRoomVoiceChat)
  yield takeEvery(JOIN_OPUS_VOICE_CHAT, handleJoinOpusVoiceChat)
  yield takeEvery(LEAVE_VOICE_CHAT, handleLeaveVoiceChat)

  yield takeEvery(SET_VOICE_CHAT_HANDLER, handleChangeVoiceChatHandler)

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

function* handleJoinLiveKitRoomVoiceChat() {
  voiceChatLogger.log('join livekit voice chat')

  // TODO: On error, join opus
}

function* handleJoinOpusVoiceChat() {
  voiceChatLogger.log('join opus voice chat')
  const commsContext = yield select(getCommsContext)
  if (commsContext) {
    const voiceHandler = createOpusVoiceHandler(commsContext.worldInstanceConnection)

    voiceHandler.onRecording((recording) => {
      store.dispatch(voiceRecordingUpdate(recording))
    })

    voiceHandler.onUserTalking((userId, talking) => {
      store.dispatch(voicePlayingUpdate(userId, talking))
    })

    positionObservable.add((obj: Readonly<PositionReport>) => {
      voiceHandler.reportPosition(positionReportToCommsPosition(obj))
    })

    yield put(setVoiceChatHandler(voiceHandler))
  }
}

function* handleLeaveVoiceChat() {
  yield put(setVoiceChatHandler(undefined))
}

function* handleChangeVoiceChatHandler(action: SetVoiceChatHandlerAction) {
  if (action.payload.voiceChat) {
    getUnityInstance().SetVoiceChatStatus({ isConnected: true })
  } else {
    getUnityInstance().SetVoiceChatStatus({ isConnected: false })
  }
}

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
