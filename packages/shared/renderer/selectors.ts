import { RootRendererState } from './types'

export function isRendererInitialized(state: RootRendererState) {
  return state && state.renderer && state.renderer.initialized
}
export function getParcelLoadingStarted(state: RootRendererState) {
  return state && state.renderer && state.renderer.parcelLoadingStarted
}
