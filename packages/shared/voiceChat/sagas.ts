import { call, select, takeEvery, takeLatest, put } from 'redux-saga/effects'
import { receiveUserTalking } from 'shared/comms/peers'
import { getCommsContext, getCommsIsland, getRealm } from 'shared/comms/selectors'
import { VOICE_CHAT_SAMPLE_RATE } from 'voice-chat-codec/constants'
import { createOpusVoiceHandler } from 'voice-chat-codec/opusVoiceHandler'
import { createLiveKitVoiceHandler } from 'voice-chat-codec/liveKitVoiceHandler'
import { VoiceHandler } from 'voice-chat-codec/VoiceHandler'
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
  clearVoiceChatError
} from './actions'
import { voiceChatLogger } from './context'
import { store } from 'shared/store/isolatedStore'
import {
  getVoiceHandler,
  isVoiceChatAllowedByCurrentScene,
  isRequestedVoiceChatRecording,
  getVoiceChatState,
  hasJoined
} from './selectors'
import { positionObservable, PositionReport } from 'shared/world/positionThings'
import { positionReportToCommsPosition } from 'shared/comms/interface/utils'
import { trackEvent } from 'shared/analytics'
import { VoiceChatState } from './types'
import { Observer } from 'mz-observable'

import { Room } from 'livekit-client' // temp
import { getIdentity } from 'shared/session'
import { SET_COMMS_ISLAND, SET_WORLD_CONTEXT } from 'shared/comms/actions'
import { realmToConnectionString } from 'shared/comms/v3/resolver'
import { getLiveKitVoiceChat } from 'shared/meta/selectors'
import { waitForMetaConfigurationInitialization } from 'shared/meta/sagas'
import { incrementCounter } from 'shared/occurences'

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

  yield takeLatest([SET_COMMS_ISLAND, SET_WORLD_CONTEXT], customLiveKitRoom)
}

/*
 * Test function until we have the room from the transport or a catalyst
 * This will get the token from a custom/temporal server which generates token for LiveKit
 * TODO: Move this to Comms v3 with LiveKit, and set the room there
 */
export function* customLiveKitRoom() {
  yield call(waitForMetaConfigurationInitialization)
  if (yield select(getLiveKitVoiceChat)) {
    const realm = yield select(getRealm)
    const realmName = realm ? realmToConnectionString(realm) : 'global'
    const island = (yield select(getCommsIsland)) ?? 'global'
    const roomName = `${realmName}-${island}`

    const identity = yield select(getIdentity)
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
  }
}

function* handleRecordingRequest() {
  const requestedRecording = yield select(isRequestedVoiceChatRecording)
  const voiceHandler: VoiceHandler | null = yield select(getVoiceHandler)

  if (voiceHandler) {
    if (!isVoiceChatAllowedByCurrentScene() || !requestedRecording) {
      voiceHandler.setRecording(false)
    } else {
      yield call(requestUserMedia)
      voiceHandler.setRecording(true)
    }
  }
}

// on change the livekit room or token, we just leave and join the room to use (or not) the LiveKit
function* handleSetVoiceChatLiveKitRoom() {
  if (yield select(hasJoined)) {
    yield put(leaveVoiceChat())
    yield put(joinVoiceChat())
  }
}

function* handleJoinVoiceChat() {
  voiceChatLogger.log('join voice chat')
  const commsContext = yield select(getCommsContext)
  const voiceChatState: VoiceChatState = yield select(getVoiceChatState)
  if (commsContext) {
    const voiceHandler: VoiceHandler =
      voiceChatState.liveKitRoom !== null
        ? yield call(createLiveKitVoiceHandler, voiceChatState.liveKitRoom)
        : createOpusVoiceHandler(commsContext.worldInstanceConnection)

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
  const voiceHandler: VoiceHandler | null = yield select(getVoiceHandler)
  if (voiceHandler && voiceHandler.leave) {
    yield voiceHandler.leave()
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

let audioRequestPending = false

async function requestMediaDevice(deviceId?: string) {
  if (!audioRequestPending) {
    audioRequestPending = true

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
      audioRequestPending = false
    }
  }
}
