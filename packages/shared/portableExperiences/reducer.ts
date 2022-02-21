import { AnyAction } from 'redux'
import { PortableExperiencesState } from './types'
import {
  DENY_PORTABLE_EXPERIENCES,
  DenyPortableExperiencesAction,
  AddScenePortableExperienceAction,
  RemoveScenePortableExperienceAction,
  ADD_SCENE_PX,
  REMOVE_SCENE_PX,
  RELOAD_SCENE_PX,
  ReloadScenePortableExperienceAction
} from './actions'

const INITIAL_STATE: PortableExperiencesState = {
  deniedPortableExperiencesFromRenderer: [],
  portableExperiencesCreatedByScenesList: {}
}

export function portableExperienceReducer(
  state?: PortableExperiencesState,
  action?: AnyAction
): PortableExperiencesState {
  if (!state) {
    return INITIAL_STATE
  }
  if (!action) {
    return state
  }

  switch (action.type) {
    case DENY_PORTABLE_EXPERIENCES: {
      const { payload } = action as DenyPortableExperiencesAction
      return { ...state, deniedPortableExperiencesFromRenderer: payload.urnList }
    }
    case ADD_SCENE_PX: {
      const { payload } = action as AddScenePortableExperienceAction
      return {
        ...state,
        portableExperiencesCreatedByScenesList: {
          ...state.portableExperiencesCreatedByScenesList,
          [payload.data.id]: payload.data
        }
      }
    }
    case RELOAD_SCENE_PX: {
      const { payload } = action as ReloadScenePortableExperienceAction
      return {
        ...state,
        portableExperiencesCreatedByScenesList: {
          ...state.portableExperiencesCreatedByScenesList,
          [payload.data.id]: payload.data
        }
      }
    }
    case REMOVE_SCENE_PX: {
      const { payload } = action as RemoveScenePortableExperienceAction
      const newState = {
        ...state,
        portableExperiencesCreatedByScenesList: { ...state.portableExperiencesCreatedByScenesList }
      }
      delete newState.portableExperiencesCreatedByScenesList[payload.urn]
      return newState
    }
  }

  return state
}
