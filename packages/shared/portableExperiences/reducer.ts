import { AnyAction } from 'redux'
import { PortableExperiencesState } from './types'
import { DENY_PORTABLE_EXPERIENCES, DenyPortableExperiencesAction } from './actions'

const INITIAL_STATE: PortableExperiencesState = {
  deniedPortableExperiencesFromRenderer: []
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
  }

  return state
}
