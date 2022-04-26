import { PortableExperiencesState } from './types'
import {
  ACTIVATE_ALL_PORTABLE_EXPERIENCES,
  ADD_SCENE_PX,
  DENY_PORTABLE_EXPERIENCES,
  PortableExperienceActions,
  RELOAD_SCENE_PX,
  REMOVE_SCENE_PX,
  SHUTDOWN_ALL_PORTABLE_EXPERIENCES
} from './actions'

const INITIAL_STATE: PortableExperiencesState = {
  deniedPortableExperiencesFromRenderer: [],
  portableExperiencesCreatedByScenesList: {},
  globalPortalExperienceShutDown: false
}

export function portableExperienceReducer(
  state?: PortableExperiencesState,
  action?: PortableExperienceActions
): PortableExperiencesState {
  if (!state) {
    return INITIAL_STATE
  }
  if (!action) {
    return state
  }

  switch (action.type) {
    case SHUTDOWN_ALL_PORTABLE_EXPERIENCES: {
      return { ...state, globalPortalExperienceShutDown: true }
    }
    case ACTIVATE_ALL_PORTABLE_EXPERIENCES: {
      return { ...state, globalPortalExperienceShutDown: false }
    }
    case DENY_PORTABLE_EXPERIENCES: {
      const { payload } = action
      return { ...state, deniedPortableExperiencesFromRenderer: payload.urnList }
    }
    case ADD_SCENE_PX: {
      const { payload } = action
      return {
        ...state,
        portableExperiencesCreatedByScenesList: {
          ...state.portableExperiencesCreatedByScenesList,
          [payload.data.id]: payload.data
        }
      }
    }
    case RELOAD_SCENE_PX: {
      const { payload } = action
      return {
        ...state,
        portableExperiencesCreatedByScenesList: {
          ...state.portableExperiencesCreatedByScenesList,
          [payload.data.id]: payload.data
        }
      }
    }
    case REMOVE_SCENE_PX: {
      const { payload } = action
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
