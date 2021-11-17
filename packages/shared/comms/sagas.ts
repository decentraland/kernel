import { put, takeEvery, select, call, takeLatest } from 'redux-saga/effects'

import { EDITOR } from 'config'

import { establishingComms, FATAL_ERROR } from 'shared/loading/types'
import { USER_AUTHENTIFIED } from 'shared/session/actions'
import { waitForRealmInitialized, selectRealm } from 'shared/dao/sagas'
import { getRealm } from 'shared/dao/selectors'
import { CATALYST_REALMS_SCAN_SUCCESS, setCatalystRealm } from 'shared/dao/actions'
import { Realm } from 'shared/dao/types'
import { realmToString } from 'shared/dao/utils/realmToString'

import { CommsContext, commsLogger } from './context'
import { connect, initComms } from '.'

import {
  SetVoiceMute,
  SetVoiceVolume,
  SET_VOICE_CHAT_RECORDING,
  SET_VOICE_MUTE,
  SET_VOICE_VOLUME,
  TOGGLE_VOICE_CHAT_RECORDING,
  VoicePlayingUpdate,
  VoiceRecordingUpdate,
  VOICE_PLAYING_UPDATE,
  VOICE_RECORDING_UPDATE
} from './actions'

import { isVoiceChatAllowedByCurrentScene, isVoiceChatRecording } from './selectors'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { sceneObservable } from 'shared/world/sceneState'
import { SceneFeatureToggles } from 'shared/types'
import { isFeatureToggleEnabled } from 'shared/selectors'
import { waitForRendererInstance } from 'shared/renderer/sagas'
import { setVoiceCommunicatorInputStream, voiceCommunicator } from './voice-over-comms'
import { VOICE_CHAT_SAMPLE_RATE } from 'voice-chat-codec/constants'
import { getCommsContext, getPrevCommsContext } from 'shared/protocol/selectors'
import { BEFORE_UNLOAD, setWorldContext, SET_WORLD_CONTEXT } from 'shared/protocol/actions'

export function* commsSaga() {
  yield takeEvery(USER_AUTHENTIFIED, userAuthentified)
  yield takeLatest(CATALYST_REALMS_SCAN_SUCCESS, changeRealm)

  yield takeEvery(FATAL_ERROR, function* () {
    // set null context on fatal error
    yield put(setWorldContext(undefined))
  })

  yield takeEvery(SET_WORLD_CONTEXT, handleNewCommsContext)

  yield takeEvery(BEFORE_UNLOAD, function* () {
    // this would disconnect the comms context
    yield put(setWorldContext(undefined))
  })

  yield call(initComms)
}

function* handleNewCommsContext() {
  const oldContext = (yield select(getPrevCommsContext)) as CommsContext | undefined
  const newContext = (yield select(getCommsContext)) as CommsContext | undefined

  if (oldContext && oldContext !== newContext) {
    // disconnect previous context
    yield call(oldContext.disconnect)
  }
}

function* listenToWhetherSceneSupportsVoiceChat() {
  sceneObservable.add(({ previousScene, newScene }) => {
    const previouslyEnabled = previousScene
      ? isFeatureToggleEnabled(SceneFeatureToggles.VOICE_CHAT, previousScene.sceneJsonData)
      : undefined
    const nowEnabled = newScene
      ? isFeatureToggleEnabled(SceneFeatureToggles.VOICE_CHAT, newScene.sceneJsonData)
      : undefined
    if (previouslyEnabled !== nowEnabled && nowEnabled !== undefined) {
      getUnityInstance().SetVoiceChatEnabledByScene(nowEnabled)
      if (!nowEnabled) {
        // We want to stop any potential recordings when a user enters a new scene
        updateVoiceRecordingStatus(false).catch(commsLogger.error)
      }
    }
  })
}

function* userAuthentified() {
  if (EDITOR) {
    return
  }

  yield call(waitForRealmInitialized)

  yield takeEvery(SET_VOICE_CHAT_RECORDING, updateVoiceChatRecordingStatus)
  yield takeEvery(TOGGLE_VOICE_CHAT_RECORDING, updateVoiceChatRecordingStatus)
  yield takeEvery(VOICE_PLAYING_UPDATE, updateUserVoicePlaying)
  yield takeEvery(VOICE_RECORDING_UPDATE, updatePlayerVoiceRecording)
  yield takeEvery(SET_VOICE_VOLUME, updateVoiceChatVolume)
  yield takeEvery(SET_VOICE_MUTE, updateVoiceChatMute)
  yield listenToWhetherSceneSupportsVoiceChat()

  yield put(establishingComms())

  yield call(connect)
}

function* updateVoiceChatRecordingStatus() {
  const recording = yield select(isVoiceChatRecording)
  yield call(updateVoiceRecordingStatus, recording)
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

function* updateVoiceChatVolume(action: SetVoiceVolume) {
  if (voiceCommunicator) {
    voiceCommunicator.setVolume(action.payload.volume)
  }
}

function* updateVoiceChatMute(action: SetVoiceMute) {
  if (voiceCommunicator) {
    voiceCommunicator.setMute(action.payload.mute)
  }
}

function* updatePlayerVoiceRecording(action: VoiceRecordingUpdate) {
  yield call(waitForRendererInstance)
  getUnityInstance().SetPlayerTalking(action.payload.recording)
}

function* changeRealm() {
  const currentRealm: ReturnType<typeof getRealm> = yield select(getRealm)

  if (!currentRealm) {
    commsLogger.info(`No realm set, wait for actual DAO initialization`)
    // if not realm is set => wait for actual dao initialization
    return
  }

  const otherRealm = yield call(selectRealm)

  if (!sameRealm(currentRealm, otherRealm)) {
    commsLogger.info(`Changing realm from ${realmToString(currentRealm)} to ${realmToString(otherRealm)}`)
    yield put(setCatalystRealm(otherRealm))
  } else {
    commsLogger.info(`Realm already set ${realmToString(currentRealm)}`)
  }
}

function sameRealm(realm1: Realm, realm2: Realm) {
  return realm1.catalystName === realm2.catalystName && realm2.domain === realm2.domain
}

let audioRequestPending = false

async function requestMediaDevice() {
  // TODO: Push redux action to inform the user to ACCEPT the microphone usage

  if (!audioRequestPending) {
    audioRequestPending = true

    try {
      // tslint:disable-next-line
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

      await setVoiceCommunicatorInputStream(media)
    } catch (e: any) {
      commsLogger.log('Error requesting audio: ', e)
    } finally {
      audioRequestPending = false
    }
  }
}

async function updateVoiceRecordingStatus(recording: boolean) {
  if (!voiceCommunicator) {
    return
  }

  if (!isVoiceChatAllowedByCurrentScene()) {
    voiceCommunicator.pause()
    return
  }

  if (!recording) {
    voiceCommunicator.pause()
    return
  }

  if (!voiceCommunicator.hasInput()) {
    await requestMediaDevice()
  } else {
    voiceCommunicator.start()
  }
}
