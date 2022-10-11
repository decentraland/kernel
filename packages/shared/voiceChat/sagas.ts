import { call, select, takeEvery, takeLatest, put } from 'redux-saga/effects'
import { receiveUserTalking } from 'shared/comms/peers'
import { getCommsIsland } from 'shared/comms/selectors'
import { VOICE_CHAT_SAMPLE_RATE } from 'voice-chat-codec/constants'
import { createOpusVoiceHandler } from './opusVoiceHandler'
import { createLiveKitVoiceHandler } from './liveKitVoiceHandler'
import { VoiceHandler } from './VoiceHandler'
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
  SET_VOICE_CHAT_MEDIA,
  setVoiceChatLiveKitRoom,
  joinVoiceChat,
  clearVoiceChatError,
  SET_AUDIO_DEVICE,
  SetAudioDevice
} from './actions'
import { voiceChatLogger } from './context'
import { store } from 'shared/store/isolatedStore'
import {
  getVoiceHandler,
  isVoiceChatAllowedByCurrentScene,
  isRequestedVoiceChatRecording,
  getVoiceChatState,
  hasJoinedVoiceChat
} from './selectors'
import { positionObservable, PositionReport } from 'shared/world/positionThings'
import { positionReportToCommsPositionRfc4 } from 'shared/comms/interface/utils'
import { trackEvent } from 'shared/analytics'
import { VoiceChatState } from './types'
import { Observer } from 'mz-observable'

import { Room } from 'livekit-client' // temp
import { SET_COMMS_ISLAND, SET_ROOM_CONNECTION } from 'shared/comms/actions'
import { isLiveKitVoiceChatFeatureFlag } from 'shared/meta/selectors'
import { waitForMetaConfigurationInitialization } from 'shared/meta/sagas'
import { incrementCounter } from 'shared/occurences'
import { getRealmConnectionString } from 'shared/realm/selectors'
import { getCurrentIdentity } from 'shared/session/selectors'

let positionObserver: Observer<Readonly<PositionReport>> | null
let audioRequestInitialized = false

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

  yield takeLatest([SET_COMMS_ISLAND, SET_ROOM_CONNECTION], handleNewRoomOrCommsContext)
  yield takeEvery(SET_AUDIO_DEVICE, setAudioDevices)
}

/*
 * Test function until we have the room from the transport or a catalyst
 * This will get the token from a custom/temporal server which generates token for LiveKit
 * TODO: Move this to Comms v3 with LiveKit, and set the room there
 */
export function* handleNewRoomOrCommsContext() {
  yield call(waitForMetaConfigurationInitialization)

  if (yield select(isLiveKitVoiceChatFeatureFlag)) {
    const realmName: string = yield select(getRealmConnectionString)
    const island = (yield select(getCommsIsland)) ?? 'global'
    const roomName = `${realmName}-${island}`

    const identity = yield select(getCurrentIdentity)
    if (identity) {
      const url = `https://livekit-token.decentraland.io/create?participantName=${identity.address}&roomName=${roomName}`
      const res: Response = yield fetch(url)
      if (!res.ok) return
      const data = yield res.json()

      // creates a new room with options
      const room = new Room()

      yield room.connect('wss://test-livekit.decentraland.today', data.token)
      yield put(setVoiceChatLiveKitRoom(room))
    }
  } else {
    // reconnect voice chat
    yield call(handleSetVoiceChatLiveKitRoom)
  }
}

function* handleRecordingRequest() {
  const requestedRecording = yield select(isRequestedVoiceChatRecording)
  const voiceHandler: VoiceHandler | null = yield select(getVoiceHandler)

  if (voiceHandler) {
    const isAlowedByScene: boolean = yield select(isVoiceChatAllowedByCurrentScene)
    if (!isAlowedByScene || !requestedRecording) {
      voiceHandler.setRecording(false)
    } else {
      yield call(requestUserMedia)
      voiceHandler.setRecording(true)
    }
  }
}

// on change the livekit room or token, we just leave and join the room to use (or not) the LiveKit
function* handleSetVoiceChatLiveKitRoom() {
  if (yield select(hasJoinedVoiceChat)) {
    yield put(leaveVoiceChat())
    yield put(joinVoiceChat())
  }
}

function* handleJoinVoiceChat() {
  voiceChatLogger.log('join voice chat')
  const voiceChatState: VoiceChatState = yield select(getVoiceChatState)

  const voiceHandler: VoiceHandler =
    voiceChatState.liveKitRoom !== null
      ? yield call(createLiveKitVoiceHandler, voiceChatState.liveKitRoom)
      : yield call(createOpusVoiceHandler)

  yield put(clearVoiceChatError())

  voiceHandler.onRecording((recording) => {
    store.dispatch(voiceRecordingUpdate(recording))
  })

  voiceHandler.onUserTalking((userId, talking) => {
    store.dispatch(voicePlayingUpdate(userId, talking))
  })

  voiceHandler.onError((message) => {
    put(setVoiceChatError(message))
  })

  if (positionObserver) {
    positionObservable.remove(positionObserver)
  }
  positionObserver = positionObservable.add((obj: Readonly<PositionReport>) => {
    voiceHandler.reportPosition(positionReportToCommsPositionRfc4(obj))
  })

  voiceHandler.setVolume(voiceChatState.volume)
  voiceHandler.setMute(voiceChatState.mute)
  if (voiceChatState.media) {
    yield voiceHandler.setInputStream(voiceChatState.media)
  }

  yield put(setVoiceChatHandler(voiceHandler))
}

function* handleVoiceChatError({ payload }: SetVoiceChatErrorAction) {
  if (payload.message) {
    trackEvent('error', {
      context: 'voice-chat',
      message: 'stream recording error: ' + payload.message,
      stack: ''
    })
    incrementCounter('voiceChatHandlerError')
    store.dispatch(leaveVoiceChat())
  }
}

function* handleLeaveVoiceChat() {
  if (positionObserver) {
    positionObservable.remove(positionObserver)
  }
  yield put(setVoiceChatHandler(null))
}

function* handleVoiceChatMedia({ payload }: SetVoiceChatMediaAction) {
  const voiceHandler: VoiceHandler | null = yield select(getVoiceHandler)
  if (voiceHandler && payload.media) {
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

function* setAudioDevices(action: SetAudioDevice) {
  if (!audioRequestInitialized && action.payload.devices.inputDeviceId) {
    const media = yield call(requestMediaDevice, action.payload.devices.inputDeviceId)
    yield put(setVoiceChatMedia(media))
  }
}

export async function requestMediaDevice(deviceId?: string) {
  if (!audioRequestInitialized) {
    audioRequestInitialized = true

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId,
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
      trackEvent('error', {
        context: 'voice-chat',
        message: 'Error requesting audio: ' + e,
        stack: ''
      })
      incrementCounter('voiceChatRequestMediaDeviceFail')
    } finally {
      audioRequestInitialized = false
    }
  }
}
