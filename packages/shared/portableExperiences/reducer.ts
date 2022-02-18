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
      // If the player denies a PX by scene or debug, it'll be removed from the list
      //   of experiences and there is no way to respawn again.
      // So it's neccesary to remove from that list directly and filter the denies PXs
      // Renderer knows about smart wearable, so this is not neccesary for those

      const { payload } = action as DenyPortableExperiencesAction

      const debugPxUrnList = Object.keys(state.debugPortableExperiencesList)
      const debugPxToRemoveList = debugPxUrnList.filter((debugPxUrn) => payload.urnList.includes(debugPxUrn))

      // The final deny list shouldn't have debug px
      const newDenylist = payload.urnList.filter((item) => !debugPxUrnList.includes(item))
      const newState = {
        ...state,
        debugPortableExperiencesList: { ...state.debugPortableExperiencesList },
        deniedPortableExperiencesFromRenderer: newDenylist
      }

      for (const debugPxUrn of debugPxToRemoveList) {
        delete newState.debugPortableExperiencesList[debugPxUrn]
      }

      return newState
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
