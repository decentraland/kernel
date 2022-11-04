import { LoginState } from '@dcl/kernel-interface'
import { DEBUG_DISABLE_LOADING } from 'config'
import { getIsSignUp } from 'shared/session/selectors'
import { RootState } from 'shared/store/rootTypes'
import { RootLoadingState } from './reducer'

export const getFatalError = (state: RootLoadingState) => state.loading.error
export const getLoadingState = (state: RootLoadingState) => state.loading

export function hasPendingScenes(state: RootLoadingState) {
  return state.loading.pendingScenes !== 0
}

export function isLoadingScreenVisible(state: RootState) {
  const { session, renderer, sceneLoader } = state

  if (state.loading.renderingWasActivated && DEBUG_DISABLE_LOADING) {
    // hack, remove in RFC-1
    return false
  }

  // in the case of signup, we show the avatars editor instead of the loading screen
  // that is so, to enable the user to customize the avatar while loading the world
  if (session.isSignUp && session.loginState === LoginState.WAITING_PROFILE) {
    return false
  }

  // loading while we don't have a BFF
  if (!state.realm.realmAdapter) {
    return true
  }

  // if parcel loading is not yet started, the loading screen should be visible
  if (!renderer.parcelLoadingStarted) {
    return true
  }

  // if parcel loading is not yet started, the loading screen should be visible
  if (!sceneLoader.positionSettled) {
    return true
  }

  // if the camera is offline, it definitely means we are loading.
  // This logic should be handled by Unity
  // Teleporting is also handled by this function. Since rendering is
  // deactivated on Position.unsettled events
  return !state.loading.renderingWasActivated
}

// the strategy with this function is to fail fast with "false" and then
// cascade until find a "true"
export function isRendererVisible(state: RootState) {
  // of course, if the renderer is not initialized, it is not visible
  if (!state.renderer.initialized) {
    return false
  }

  // some login stages requires the renderer to be turned off
  const { loginState } = state.session
  if (loginState === LoginState.WAITING_PROFILE && getIsSignUp(state)) {
    return true
  }

  // once the renderer starts, it should be visible forever
  if (state.loading.renderingWasActivated) {
    return true
  }

  // if it is not yet loading scenes, renderer should not be visible either
  if (!state.renderer.parcelLoadingStarted) {
    return false
  }

  if (
    loginState === LoginState.SIGNATURE_FAILED ||
    loginState === LoginState.SIGNATURE_PENDING ||
    loginState === LoginState.WAITING_PROVIDER
  ) {
    return false
  }

  if (loginState === LoginState.COMPLETED) {
    return true
  }

  return isLoadingScreenVisible(state)
}
