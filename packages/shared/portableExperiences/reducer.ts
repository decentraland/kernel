import { AnyAction } from 'redux'
import { PortableExperiencesState } from './types'
import {
  DENY_PORTABLE_EXPERIENCES,
  DenyPortableExperiencesAction,
  ADD_DEBUG_PX,
  AddDebugPortableExperienceAction,
  REMOVE_DEBUG_PX,
  RemoveDebugPortableExperienceAction
} from './actions'

const INITIAL_STATE: PortableExperiencesState = {
  deniedPortableExperiencesFromRenderer: [],
  debugPortableExperiencesList: {},
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
    case ADD_DEBUG_PX: {
      const { payload } = action as AddDebugPortableExperienceAction
      return {
        ...state,
        debugPortableExperiencesList: { ...state.debugPortableExperiencesList, [payload.data.id]: payload.data }
      }
    }
    case REMOVE_DEBUG_PX: {
      const { payload } = action as RemoveDebugPortableExperienceAction
      const newState = { ...state, debugPortableExperiencesList: { ...state.debugPortableExperiencesList } }
      delete newState.debugPortableExperiencesList[payload.urn]
      return newState
    }
  }

  return state
}
