import { RootRendererState } from './types'

export function isRendererInitialized(state: RootRendererState) {
  return state && state.renderer && state.renderer.initialized
}
export function isRendererReady(state: RootRendererState) {
  return state && state.renderer && state.renderer.engineReady
}
export function getParcelLoadingStarted(state: RootRendererState) {
  return state && state.renderer && state.renderer.parcelLoadingStarted
}
