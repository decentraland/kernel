import { AnyAction } from 'redux'
import { PARCEL_LOADING_STARTED, RendererState, RENDERER_INITIALIZED_CORRECTLY, RENDERER_READY } from './types'

const INITIAL_STATE: RendererState = {
  initialized: false,
  parcelLoadingStarted: false,
  engineReady: false
}

export function rendererReducer(state?: RendererState, action?: AnyAction): RendererState {
  if (!state) {
    return INITIAL_STATE
  }
  if (!action) {
    return state
  }
  switch (action.type) {
    case RENDERER_INITIALIZED_CORRECTLY:
      return {
        ...state,
        initialized: true
      }
    case PARCEL_LOADING_STARTED:
      return {
        ...state,
        parcelLoadingStarted: true
      }
    case RENDERER_READY:
      return {
        ...state,
        engineReady: true
      }
    default:
      return state
  }
}
