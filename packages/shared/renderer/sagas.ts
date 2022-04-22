import { call, put, select, take, takeLatest } from 'redux-saga/effects'
import { waitingForRenderer } from 'shared/loading/types'
import { initializeEngine } from 'unity-interface/dcl'
import type { UnityGame } from '@dcl/unity-renderer/src/index'
import { InitializeRenderer } from './actions'
import { getParcelLoadingStarted, isRendererInitialized, isRendererReady } from './selectors'
import { RENDERER_INITIALIZED_CORRECTLY, RENDERER_INITIALIZE, RENDERER_READY } from './types'
import { trackEvent } from 'shared/analytics'
import { ParcelsWithAccess } from '@dcl/legacy-ecs'
import { Avatar } from '@dcl/schemas'
import {
  SendProfileToRenderer,
  addedProfileToCatalog,
  SEND_PROFILE_TO_RENDERER,
  sendProfileToRenderer
} from 'shared/profiles/actions'
import { getProfile, getHasConnectedWeb3 } from 'shared/profiles/selectors'
import { profileToRendererFormat } from 'shared/profiles/transformations/profileToRendererFormat'
import { isCurrentUserId, getCurrentIdentity, getCurrentUserId } from 'shared/session/selectors'
import { ExplorerIdentity } from 'shared/session/types'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { takeLatestByUserId } from 'shared/profiles/sagas'
import { fetchParcelsWithAccess } from 'shared/profiles/fetchLand'
import { UPDATE_LOADING_SCREEN } from 'shared/loading/actions'
import { isLoadingScreenVisible, getLoadingState } from 'shared/loading/selectors'
import { SignUpSetIsSignUp, SIGNUP_SET_IS_SIGNUP } from 'shared/session/actions'

export function* waitForRendererInstance() {
  while (!(yield select(isRendererInitialized))) {
    yield take(RENDERER_INITIALIZED_CORRECTLY)
  }
}

export function* waitForRendererReady() {
  while (!(yield select(isRendererReady))) {
    yield take(RENDERER_READY)
  }
}

export function* rendererSaga() {
  yield takeLatestByUserId(SEND_PROFILE_TO_RENDERER, handleSubmitProfileToRenderer)
  yield takeLatest(SIGNUP_SET_IS_SIGNUP, sendSignUpToRenderer)
  yield takeLatest(UPDATE_LOADING_SCREEN, updateLoadingScreen)

  const action: InitializeRenderer = yield take(RENDERER_INITIALIZE)
  yield call(initializeRenderer, action)
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

function* handleSubmitProfileToRenderer(action: SendProfileToRenderer): any {
  const { userId } = action.payload

  yield call(waitForRendererInstance)

  const avatar: Avatar | null = yield select(getProfile, userId)
  if (!avatar) {
    debugger
    throw new Error('Avatar not available for Unity')
  }
  const hasConnectedWeb3: boolean = yield select(getHasConnectedWeb3, userId)

  if (yield select(isCurrentUserId, userId)) {
    const identity: ExplorerIdentity = yield select(getCurrentIdentity)
    let parcels: ParcelsWithAccess = []
    if (hasConnectedWeb3) {
      parcels = yield call(fetchParcelsWithAccess, identity.address)
    }
    const forRenderer = profileToRendererFormat(avatar, { identity, parcels })
    getUnityInstance().LoadProfile(forRenderer)
  } else {
    const forRenderer = profileToRendererFormat(avatar, {})
    forRenderer.hasConnectedWeb3 = hasConnectedWeb3
    getUnityInstance().AddUserProfileToCatalog(forRenderer)
    yield put(addedProfileToCatalog(userId, avatar))
  }
}
