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
  VoicePlayingUpdateAction,
  SetVoiceChatVolumeAction,
  SetVoiceChatMuteAction,
  setVoiceChatHandler,
  JOIN_VOICE_CHAT,
  voiceRecordingUpdate,
  voicePlayingUpdate,
  setVoiceChatError,
  leaveVoiceChat,
  SetVoiceChatErrorAction,
  SET_VOICE_CHAT_ERROR,
  SET_VOICE_CHAT_LIVE_KIT_ROOM,
  SetVoiceChatMediaAction,
  setVoiceChatMedia,
  SET_VOICE_CHAT_MEDIA
} from './actions'
import { voiceChatLogger } from './context'
import { store } from 'shared/store/isolatedStore'
import {
  getVoiceHandler,
  isVoiceChatAllowedByCurrentScene,
  isRequestedVoiceChatRecording,
  getVoiceChatState
} from './selectors'
import { positionObservable, PositionReport } from 'shared/world/positionThings'
import { positionReportToCommsPosition } from 'shared/comms/interface/utils'
import defaultLogger from 'shared/logger'
import { trackEvent } from 'shared/analytics'
import { VoiceChatState } from './types'
import { Observer } from 'mz-observable'

let positionObserver: Observer<Readonly<PositionReport>> | null

export function* voiceChatSaga() {
  yield takeEvery(SET_VOICE_CHAT_LIVE_KIT_ROOM, handleSetVoiceChatLiveKitRoom)
  yield takeEvery(JOIN_VOICE_CHAT, handleJoinVoiceChat)
  yield takeEvery(LEAVE_VOICE_CHAT, handleLeaveVoiceChat)

  yield takeLatest(REQUEST_VOICE_CHAT_RECORDING, handleRecordingRequest)
  yield takeLatest(REQUEST_TOGGLE_VOICE_CHAT_RECORDING, handleRecordingRequest)

  yield takeEvery(VOICE_PLAYING_UPDATE, handleUserVoicePlaying)

  yield takeEvery(SET_VOICE_CHAT_VOLUME, handleVoiceChatVolume)
  yield takeEvery(SET_VOICE_CHAT_MUTE, handleVoiceChatMute)
  yield takeEvery(SET_VOICE_CHAT_MEDIA, handleVoiceChatMedia)

  yield takeEvery(SET_VOICE_CHAT_ERROR, handleVoiceChatError)
}

function* handleRecordingRequest() {
  const requestedRecording = yield select(isRequestedVoiceChatRecording)
  const voiceHandler: VoiceHandler | null = yield select(getVoiceHandler)

  defaultLogger.log('handleVoiceChatRecordingStatus', requestedRecording, voiceHandler)

  if (voiceHandler) {
    if (!isVoiceChatAllowedByCurrentScene() || !requestedRecording) {
      voiceHandler.setRecording(false)
    } else {
      yield call(requestUserMedia)
      voiceHandler.setRecording(true)
      defaultLogger.log('voiceHandler.setRecording(true)')
    }
  }
}

// on change the livekit room or token, we just leave and join the room to use (or not) the LiveKit
function* handleSetVoiceChatLiveKitRoom() {
  yield call(handleLeaveVoiceChat)
  yield call(handleJoinVoiceChat)
}

function* handleJoinVoiceChat() {
  voiceChatLogger.log('join voice chat')
  const commsContext = yield select(getCommsContext)
  const voiceChatState: VoiceChatState = yield select(getVoiceChatState)
  if (commsContext) {
    const voiceHandler =
      voiceChatState.liveKit !== undefined
        ? createOpusVoiceHandler(commsContext.worldInstanceConnection)
        : createOpusVoiceHandler(commsContext.worldInstanceConnection)

    voiceHandler.onRecording((recording) => {
      store.dispatch(voiceRecordingUpdate(recording))
    })

    voiceHandler.onUserTalking((userId, talking) => {
      store.dispatch(voicePlayingUpdate(userId, talking))
    })

    voiceHandler.onError((message) => {
      store.dispatch(setVoiceChatError(message))
    })

    if (positionObserver) {
      positionObservable.remove(positionObserver)
    }
    positionObserver = positionObservable.add((obj: Readonly<PositionReport>) => {
      voiceHandler.reportPosition(positionReportToCommsPosition(obj))
    })

    voiceHandler.setVolume(voiceChatState.volume)
    voiceHandler.setMute(voiceChatState.mute)
    if (voiceChatState.media) {
      yield voiceHandler.setInputStream(voiceChatState.media)
    }

    yield put(setVoiceChatHandler(voiceHandler))
  }
}

function* handleVoiceChatError({ payload }: SetVoiceChatErrorAction) {
  trackEvent('error', {
    context: 'voice-chat',
    message: 'stream recording error: ' + payload.message,
    stack: 'addStreamRecordingErrorListener'
  })
  store.dispatch(leaveVoiceChat())
}

function* handleLeaveVoiceChat() {
  if (positionObserver) {
    positionObservable.remove(positionObserver)
  }
  yield put(setVoiceChatHandler(null))
}

function* handleVoiceChatMedia({ payload }: SetVoiceChatMediaAction) {
  const voiceHandler: VoiceHandler | null = yield select(getVoiceHandler)
  if (voiceHandler) {
    yield voiceHandler.setInputStream(payload.media)
  }
}

function* requestUserMedia() {
  const voiceHandler: VoiceHandler | null = yield select(getVoiceHandler)
  if (voiceHandler) {
    if (!voiceHandler.hasInput()) {
      const media = yield call(requestMediaDevice)
      yield put(setVoiceChatMedia(media))
    }
  }
}

function* handleUserVoicePlaying(action: VoicePlayingUpdateAction) {
  const { userId, playing } = action.payload
  receiveUserTalking(userId, playing)
}

function* handleVoiceChatVolume(action: SetVoiceChatVolumeAction) {
  const voiceHandler: VoiceHandler | null = yield select(getVoiceHandler)
  voiceHandler?.setVolume(action.payload.volume)
}

function* handleVoiceChatMute(action: SetVoiceChatMuteAction) {
  const voiceHandler: VoiceHandler | null = yield select(getVoiceHandler)
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
