export const RENDERER_INITIALIZED_CORRECTLY = '[RENDERER] Renderer initialized correctly'
export const PARCEL_LOADING_STARTED = '[RENDERER] Parcel loading started'
export const RENDERER_INITIALIZE = '[RENDERER] Initializing'
export const RENDERER_READY = '[RENDERER] Engine ready'

export type RendererState = {
  initialized: boolean
  parcelLoadingStarted: boolean
  engineReady: boolean
}

export type RootRendererState = {
  renderer: RendererState
}
