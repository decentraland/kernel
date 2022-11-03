import { call, put, select, take, takeEvery, takeLatest, fork } from 'redux-saga/effects'
import { waitingForRenderer } from 'shared/loading/types'
import { initializeEngine } from 'unity-interface/dcl'
import type { UnityGame } from '@dcl/unity-renderer/src/index'
import { InitializeRenderer } from './actions'
import { getParcelLoadingStarted } from './selectors'
import { RENDERER_INITIALIZE } from './types'
import { trackEvent } from 'shared/analytics'
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
import { UPDATE_LOADING_SCREEN } from 'shared/loading/actions'
import { isLoadingScreenVisible, getLoadingState } from 'shared/loading/selectors'
import { SignUpSetIsSignUp, SIGNUP_SET_IS_SIGNUP } from 'shared/session/actions'
import { isFeatureToggleEnabled } from 'shared/selectors'
import { CurrentRealmInfoForRenderer, NotificationType, VOICE_CHAT_FEATURE_TOGGLE } from 'shared/types'
import { ProfileUserInfo } from 'shared/profiles/types'
import {
  getFetchContentServerFromRealmAdapter,
  getFetchContentUrlPrefixFromRealmAdapter,
  waitForRealmAdapter
} from 'shared/realm/selectors'
import { getExploreRealmsService } from 'shared/dao/selectors'
import defaultLogger from 'shared/logger'
import { receivePeerUserData } from 'shared/comms/peers'
import { deepEqual } from 'atomicHelpers/deepEqual'
import { waitForRendererInstance } from './sagas-helper'
import { NewProfileForRenderer } from 'shared/profiles/transformations/types'
import {
  SetVoiceChatErrorAction,
  SET_VOICE_CHAT_ERROR,
  SET_VOICE_CHAT_HANDLER,
  VoicePlayingUpdateAction,
  VoiceRecordingUpdateAction,
  VOICE_PLAYING_UPDATE,
  VOICE_RECORDING_UPDATE
} from 'shared/voiceChat/actions'
import { IRealmAdapter } from 'shared/realm/types'
import { SET_REALM_ADAPTER } from 'shared/realm/actions'
import { getAllowedContentServer } from 'shared/meta/selectors'
import { SetCurrentScene, SET_CURRENT_SCENE } from 'shared/world/actions'
import { RootState } from 'shared/store/rootTypes'
import { VoiceHandler } from 'shared/voiceChat/VoiceHandler'
import { getVoiceHandler } from 'shared/voiceChat/selectors'
import { SceneWorker } from 'shared/world/SceneWorker'
import { getSceneWorkerBySceneID } from 'shared/world/parcelSceneManager'
import { LoadingState } from 'shared/loading/reducer'

export function* rendererSaga() {
  yield takeEvery(SEND_PROFILE_TO_RENDERER, handleSubmitProfileToRenderer)
  yield takeLatest(SIGNUP_SET_IS_SIGNUP, sendSignUpToRenderer)
  yield takeLatest(UPDATE_LOADING_SCREEN, updateLoadingScreen)
  yield takeEvery(VOICE_PLAYING_UPDATE, updateUserVoicePlayingRenderer)
  yield takeEvery(VOICE_RECORDING_UPDATE, updatePlayerVoiceRecordingRenderer)
  yield takeEvery(SET_VOICE_CHAT_ERROR, handleVoiceChatError)

  const action: InitializeRenderer = yield take(RENDERER_INITIALIZE)
  yield call(initializeRenderer, action)

  yield takeLatest(SET_CURRENT_SCENE, listenToWhetherSceneSupportsVoiceChat)

  yield fork(reportRealmChangeToRenderer)
  yield fork(updateChangeVoiceChatHandlerProcess)
}

/**
 * This saga sends the BFF configuration changes to the renderer upon every change
 */
function* reportRealmChangeToRenderer() {
  yield call(waitForRendererInstance)

  while (true) {
    const realmAdapter: IRealmAdapter = yield call(waitForRealmAdapter)

    try {
      const configuredContentServer: string = yield call(getFetchContentServerFromRealmAdapter, realmAdapter)
      const contentServerUrl: string = yield select(getAllowedContentServer, configuredContentServer)
      const current = convertCurrentRealmType(realmAdapter, contentServerUrl)
      defaultLogger.info('UpdateRealmsInfo', current)
      getUnityInstance().UpdateRealmsInfo({ current })

      const realmsService = yield select(getExploreRealmsService)

      if (realmsService) {
        yield call(fetchAndReportRealmsInfo, realmsService)
      }

      // wait for the next context
    } catch (err: any) {
      defaultLogger.error(err)
    }

    yield take(SET_REALM_ADAPTER)
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

function convertCurrentRealmType(realmAdapter: IRealmAdapter, contentServerUrl: string): CurrentRealmInfoForRenderer {
  return {
    serverName: realmAdapter.about.configurations?.realmName || realmAdapter.baseUrl,
    layer: '',
    domain: realmAdapter.baseUrl,
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

function* updateChangeVoiceChatHandlerProcess() {
  let prevHandler: VoiceHandler | undefined = undefined
  while (true) {
    // wait for a new VoiceHandler
    yield take(SET_VOICE_CHAT_HANDLER)

    const handler: VoiceHandler | undefined = yield select(getVoiceHandler)

    if (handler !== prevHandler) {
      if (prevHandler) {
        prevHandler.destroy()
      }
      prevHandler = handler
    }

    yield call(waitForRendererInstance)

    if (handler) {
      getUnityInstance().SetVoiceChatStatus({ isConnected: true })
    } else {
      getUnityInstance().SetVoiceChatStatus({ isConnected: false })
    }
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

function* listenToWhetherSceneSupportsVoiceChat(data: SetCurrentScene) {
  const currentScene: SceneWorker | undefined = data.payload.currentScene
    ? yield call(getSceneWorkerBySceneID, data.payload.currentScene)
    : undefined

  const nowEnabled = currentScene
    ? isFeatureToggleEnabled(VOICE_CHAT_FEATURE_TOGGLE, currentScene?.metadata)
    : isFeatureToggleEnabled(VOICE_CHAT_FEATURE_TOGGLE)

  yield call(waitForRendererInstance)

  getUnityInstance().SetVoiceChatEnabledByScene(nowEnabled)
}

/**
 * This saga hides, show and update the loading screen
 */
function* updateLoadingScreen() {
  yield call(waitForRendererInstance)

  const isVisible = yield select(isLoadingScreenVisible)

  const parcelLoadingStarted = yield select(getParcelLoadingStarted)
  const loadingState: LoadingState = yield select(getLoadingState)
  const loadingMessage: string | undefined = yield select((state: RootState): string | undefined => {
    const msgs: string[] = []
    if (!state.realm.realmAdapter) msgs.push('Picking realm...')
    else if (!state.sceneLoader) msgs.push('Initializing world loader...')
    else if (!parcelLoadingStarted) msgs.push('Fetching initial parcels...')
    else if (!state.sceneLoader.positionSettled) msgs.push('Waiting for spawn point...')

    if (!state.comms.context) msgs.push('Connecting to comms...')

    if (state.loading.pendingScenes && state.loading.totalScenes > 1) {
      msgs.push(
        `Initializing scenes ${state.loading.totalScenes - state.loading.pendingScenes}/${state.loading.totalScenes}...`
      )
    } else if (state.loading.renderingWasActivated) {
      msgs.push(`Waiting for initial render...`)
    }

    msgs.push(loadingState.message)
    return msgs.join('\n')
  })

  const loadingScreen = {
    isVisible,
    message: loadingMessage || loadingState.message || loadingState.status || '',
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
  if (!profile || !profile.data) {
    debugger
    return
  }

  const bff: IRealmAdapter = yield call(waitForRealmAdapter)
  const fetchContentServerWithPrefix = getFetchContentUrlPrefixFromRealmAdapter(bff)

  if (yield select(isCurrentUserId, userId)) {
    const identity: ExplorerIdentity = yield select(getCurrentIdentity)

    const forRenderer = profileToRendererFormat(profile.data, {
      address: identity.address,
      baseUrl: fetchContentServerWithPrefix
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
      baseUrl: fetchContentServerWithPrefix
    })
    getUnityInstance().AddUserProfileToCatalog(forRenderer)
    yield put(addedProfileToCatalog(userId, profile.data))

    // send to Avatars scene
    receivePeerUserData(profile.data, fetchContentServerWithPrefix)
  }
}
