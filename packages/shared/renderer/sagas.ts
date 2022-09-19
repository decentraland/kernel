import { call, put, select, take, takeEvery, takeLatest, fork } from 'redux-saga/effects'
import { waitingForRenderer } from 'shared/loading/types'
import { initializeEngine } from 'unity-interface/dcl'
import type { UnityGame } from '@dcl/unity-renderer/src/index'
import { InitializeRenderer } from './actions'
import { getParcelLoadingStarted } from './selectors'
import { RENDERER_INITIALIZE } from './types'
import { trackEvent } from 'shared/analytics'
import { ParcelsWithAccess } from '@dcl/legacy-ecs'
import {
  SendProfileToRenderer,
  addedProfileToCatalog,
  SEND_PROFILE_TO_RENDERER,
  sendProfileToRenderer
} from 'shared/profiles/actions'
import { getProfileFromStore } from 'shared/profiles/selectors'
import { profileToRendererFormat } from 'shared/profiles/transformations/profileToRendererFormat'
import { isCurrentUserId, getCurrentIdentity, getCurrentUserId } from 'shared/session/selectors'
import { ExplorerIdentity } from 'shared/session/types'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { takeLatestByUserId } from 'shared/profiles/sagas'
import { fetchParcelsWithAccess } from 'shared/profiles/fetchLand'
import { UPDATE_LOADING_SCREEN } from 'shared/loading/actions'
import { isLoadingScreenVisible, getLoadingState } from 'shared/loading/selectors'
import { SignUpSetIsSignUp, SIGNUP_SET_IS_SIGNUP } from 'shared/session/actions'
import { isFeatureToggleEnabled } from 'shared/selectors'
import { CurrentRealmInfoForRenderer, NotificationType, VOICE_CHAT_FEATURE_TOGGLE } from 'shared/types'
import { sceneObservable } from 'shared/world/sceneState'
import { ProfileUserInfo } from 'shared/profiles/types'
import { getCommsContext } from 'shared/comms/selectors'
import { getExploreRealmsService, getFetchContentServer, getFetchContentUrlPrefix } from 'shared/dao/selectors'
import { Realm } from 'shared/dao/types'
import { CommsContext } from 'shared/comms/context'
import defaultLogger from 'shared/logger'
import { receivePeerUserData } from 'shared/comms/peers'
import { deepEqual } from 'atomicHelpers/deepEqual'
import { waitForRendererInstance } from './sagas-helper'
import { NewProfileForRenderer } from 'shared/profiles/transformations/types'
import {
  SetVoiceChatErrorAction,
  SetVoiceChatHandlerAction,
  SET_VOICE_CHAT_ERROR,
  SET_VOICE_CHAT_HANDLER,
  VoicePlayingUpdateAction,
  VoiceRecordingUpdateAction,
  VOICE_PLAYING_UPDATE,
  VOICE_RECORDING_UPDATE
} from 'shared/voiceChat/actions'
import { SET_WORLD_CONTEXT } from 'shared/comms/actions'

export function* rendererSaga() {
  yield takeLatestByUserId(SEND_PROFILE_TO_RENDERER, handleSubmitProfileToRenderer)
  yield takeLatest(SIGNUP_SET_IS_SIGNUP, sendSignUpToRenderer)
  yield takeLatest(UPDATE_LOADING_SCREEN, updateLoadingScreen)
  yield takeEvery(VOICE_PLAYING_UPDATE, updateUserVoicePlayingRenderer)
  yield takeEvery(VOICE_RECORDING_UPDATE, updatePlayerVoiceRecordingRenderer)
  yield takeEvery(SET_VOICE_CHAT_HANDLER, updateChangeVoiceChatHandler)
  yield takeEvery(SET_VOICE_CHAT_ERROR, handleVoiceChatError)

  const action: InitializeRenderer = yield take(RENDERER_INITIALIZE)
  yield call(initializeRenderer, action)

  yield call(listenToWhetherSceneSupportsVoiceChat)

  yield fork(reportRealmChangeToRenderer)
}

function* reportRealmChangeToRenderer() {
  yield call(waitForRendererInstance)

  while (true) {
    const context: CommsContext | null = yield select(getCommsContext)

    if (context) {
      const contentServerUrl: string = yield select(getFetchContentServer)
      const current = convertCurrentRealmType(context.realm, contentServerUrl)
      getUnityInstance().UpdateRealmsInfo({ current })
    }

    const realmsService = yield select(getExploreRealmsService)

    if (realmsService) {
      yield call(fetchAndReportRealmsInfo, realmsService)
    }

    // wait for the next context
    yield take(SET_WORLD_CONTEXT)
  }
}

async function fetchAndReportRealmsInfo(url: string) {
  try {
    const response = await fetch(url)
    if (response.ok) {
      const value = await response.json()
      getUnityInstance().UpdateRealmsInfo({ realms: value })
    }
  } catch (e) {
    defaultLogger.error(url, e)
  }
}

function convertCurrentRealmType(realm: Realm, contentServerUrl: string): CurrentRealmInfoForRenderer {
  return {
    serverName: realm.serverName,
    layer: '',
    domain: realm.hostname,
    contentServerUrl: contentServerUrl
  }
}

function* updateUserVoicePlayingRenderer(action: VoicePlayingUpdateAction) {
  const { playing, userId } = action.payload
  yield call(waitForRendererInstance)
  getUnityInstance().SetUserTalking(userId, playing)
}

function* updatePlayerVoiceRecordingRenderer(action: VoiceRecordingUpdateAction) {
  yield call(waitForRendererInstance)
  getUnityInstance().SetPlayerTalking(action.payload.recording)
}

function* updateChangeVoiceChatHandler(action: SetVoiceChatHandlerAction) {
  yield call(waitForRendererInstance)
  if (action.payload.voiceHandler) {
    getUnityInstance().SetVoiceChatStatus({ isConnected: true })
  } else {
    getUnityInstance().SetVoiceChatStatus({ isConnected: false })
  }
}

function* handleVoiceChatError(action: SetVoiceChatErrorAction) {
  const message = action.payload.message
  yield call(waitForRendererInstance)
  if (message) {
    getUnityInstance().ShowNotification({
      type: NotificationType.GENERIC,
      message,
      buttonMessage: 'OK',
      timer: 5
    })
  }
}

function* listenToWhetherSceneSupportsVoiceChat() {
  sceneObservable.add(({ newScene }) => {
    const nowEnabled = newScene
      ? isFeatureToggleEnabled(VOICE_CHAT_FEATURE_TOGGLE, newScene.entity.metadata)
      : isFeatureToggleEnabled(VOICE_CHAT_FEATURE_TOGGLE)

    getUnityInstance().SetVoiceChatEnabledByScene(nowEnabled)
  })
}

/**
 * This saga hides, show and update the loading screen
 */
function* updateLoadingScreen() {
  yield call(waitForRendererInstance)

  const isVisible = yield select(isLoadingScreenVisible)
  const loadingState = yield select(getLoadingState)
  const parcelLoadingStarted = yield select(getParcelLoadingStarted)
  const loadingScreen = {
    isVisible,
    message: loadingState.message || loadingState.status || '',
    showTips: loadingState.initialLoad || !parcelLoadingStarted
  }
  getUnityInstance().SetLoadingScreen(loadingScreen)
}

function* initializeRenderer(action: InitializeRenderer) {
  const { delegate, container } = action.payload

  // will start loading
  yield put(waitingForRenderer())

  // start loading the renderer
  try {
    const renderer: UnityGame = yield call(delegate, container)

    const startTime = performance.now()

    trackEvent('renderer_initializing_start', {})

    // wire the kernel to the renderer, at some point, the `initializeEngine`
    // function _MUST_ send the `signalRendererInitializedCorrectly` action
    // to signal that the renderer successfuly loaded
    yield call(initializeEngine, renderer)

    // wait for renderer start
    yield call(waitForRendererInstance)

    trackEvent('renderer_initializing_end', {
      loading_time: performance.now() - startTime
    })
  } catch (e) {
    trackEvent('renderer_initialization_error', {
      message: e + ''
    })
    if (e instanceof Error) {
      throw e
    } else {
      throw new Error('Error initializing rendering')
    }
  }
}

function* sendSignUpToRenderer(action: SignUpSetIsSignUp) {
  if (action.payload.isSignUp) {
    getUnityInstance().ShowAvatarEditorInSignIn()

    const userId: string = yield select(getCurrentUserId)
    yield put(sendProfileToRenderer(userId))
  }
}

let lastSentProfile: NewProfileForRenderer | null = null
function* handleSubmitProfileToRenderer(action: SendProfileToRenderer): any {
  const { userId } = action.payload

  yield call(waitForRendererInstance)

  const profile: ProfileUserInfo | null = yield select(getProfileFromStore, userId)
  if (!profile) {
    debugger
    throw new Error('Profile not available for Unity')
  }
  if (!profile.data) {
    debugger
    throw new Error('Avatar not available for Unity')
  }

  const fetchContentServer = yield select(getFetchContentUrlPrefix)

  if (yield select(isCurrentUserId, userId)) {
    const identity: ExplorerIdentity = yield select(getCurrentIdentity)
    let parcels: ParcelsWithAccess = []

    if (identity.hasConnectedWeb3) {
      parcels = yield call(fetchParcelsWithAccess, identity.address)
    }

    const forRenderer = profileToRendererFormat(profile.data, {
      address: identity.address,
      parcels,
      baseUrl: fetchContentServer
    })
    forRenderer.hasConnectedWeb3 = identity.hasConnectedWeb3
    // TODO: this condition shouldn't be necessary. Unity fails with setThrew
    //       if LoadProfile is called rapidly because it cancels ongoing
    //       requests and those cancellations throw exceptions
    if (!deepEqual(lastSentProfile, forRenderer)) {
      lastSentProfile = forRenderer
      getUnityInstance().LoadProfile(forRenderer)
    }
  } else {
    const forRenderer = profileToRendererFormat(profile.data, {
      baseUrl: fetchContentServer
    })
    getUnityInstance().AddUserProfileToCatalog(forRenderer)
    yield put(addedProfileToCatalog(userId, profile.data))

    // send to Avatars scene
    receivePeerUserData(profile.data)
  }
}
