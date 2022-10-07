import { AnyAction } from 'redux'
import { SceneLoaderState } from './types'
import { POSITION_SETTLED, POSITION_UNSETTLED, SetParcelPosition, SetSceneLoader, SetWorldLoadingRadius, SET_PARCEL_POSITION, SET_SCENE_LOADER, SET_WORLD_LOADING_RADIUS } from './actions'

const INITIAL_STATE: SceneLoaderState = {
  loader: undefined,
  positionSettled: false,
  parcelPosition: { x: 0, y: 0 },
  loadingRadius: 4
}

export function sceneLoaderReducer(state?: SceneLoaderState, action?: AnyAction): SceneLoaderState {
  if (!state) {
    return INITIAL_STATE
  }
  if (!action) {
    return state
  }
  switch (action.type) {
    case SET_SCENE_LOADER:
      return {
        ...state,
        loader: (action as SetSceneLoader).payload.loader
      }
    case POSITION_SETTLED:
      return {
        ...state,
        positionSettled: true
      }
    case POSITION_UNSETTLED:
      return {
        ...state,
        positionSettled: false
      }
    case SET_WORLD_LOADING_RADIUS:
      return {
        ...state,
        loadingRadius: (action as SetWorldLoadingRadius).payload.radius
      }
    case SET_PARCEL_POSITION:
      return {
        ...state,
        parcelPosition: (action as SetParcelPosition).payload.position
      }
    default:
      return state
  }
}
