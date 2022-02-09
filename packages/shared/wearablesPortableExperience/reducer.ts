import { AnyAction } from 'redux'
import { WearablesPortableExperienceData, WearablesPortableExperienceState } from './types'
import {
  UPDATE_WEARABLES,
  UpdateWearablesAction,
  PROCESS_WEARABLES,
  ProcessWearablesAction,
  ADD_DESIRED_PORTABLE_EXPERIENCE,
  AddDesiredPortableExperienceAction,
  REMOVE_DESIRED_PORTABLE_EXPERIENCE,
  RemoveDesiredPortableExperienceAction
} from './actions'
import { WearableId } from 'shared/catalogs/types'

const INITIAL_STATE: WearablesPortableExperienceState = {
  profileWearables: {},
  wearablesWithPortableExperiences: [],
  desiredWearablePortableExperiences: {}
}

export function wearablesPortableExperienceReducer(
  state?: WearablesPortableExperienceState,
  action?: AnyAction
): WearablesPortableExperienceState {
  if (!state) {
    return INITIAL_STATE
  }
  if (!action) {
    return state
  }

  switch (action.type) {
    case UPDATE_WEARABLES: {
      const { payload } = action as UpdateWearablesAction

      // remove wearables
      let profileWearables: Record<WearableId, WearablesPortableExperienceData> = Object.keys(state.profileWearables)
        .filter((w) => !payload.wearablesToRemove.includes(w))
        .reduce((acc, k) => ({ ...acc, [k]: state.profileWearables[k] }), {})

      // add wearables
      profileWearables = payload.wearablesToAdd.reduce(
        (acc, k) => ({ ...acc, [k]: { state: 'pending' } }),
        profileWearables
      )

      return { ...state, profileWearables }
    }
    case PROCESS_WEARABLES: {
      const { payload } = action as ProcessWearablesAction
      const profileWearables = state.profileWearables
      payload.wearables.forEach((w) => {
        if (profileWearables[w.id]) {
          profileWearables[w.id].state = 'processed'
        }
      })
      return { ...state, profileWearables }
    }
    case REMOVE_DESIRED_PORTABLE_EXPERIENCE: {
      const { payload } = action as RemoveDesiredPortableExperienceAction

      const desiredWearablePortableExperiences = { ...state.desiredWearablePortableExperiences }
      delete desiredWearablePortableExperiences[payload.id]
      return { ...state, desiredWearablePortableExperiences }
    }
    case ADD_DESIRED_PORTABLE_EXPERIENCE: {
      const { payload } = action as AddDesiredPortableExperienceAction
      return {
        ...state,
        desiredWearablePortableExperiences: {
          ...state.desiredWearablePortableExperiences,
          [payload.data.id]: payload.data
        }
      }
    }
  }

  return state
}
