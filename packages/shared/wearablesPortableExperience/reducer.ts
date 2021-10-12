import { AnyAction } from 'redux'
import { WearablesPortableExperienceData, WearablesPortableExperienceState } from './types'
import {
  UPDATE_WEARABLES,
  UpdateWearablesAction,
  STOP_WEARABLES_PORTABLE_EXPERENCE,
  StopWearablesPortableExperienceAction,
  START_WEARABLES_PORTABLE_EXPERENCE,
  StartWearablesPortableExperienceAction,
  PROCESS_WEARABLES,
  ProcessWearablesAction
} from './actions'
import { WearableId } from 'shared/catalogs/types'

const INITIAL_STATE: WearablesPortableExperienceState = {
  profileWearables: {},
  wearablesWithPortableExperiences: []
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
    case UPDATE_WEARABLES:
      {
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

        state.profileWearables = profileWearables
      }
      break
    case PROCESS_WEARABLES:
      {
        const { payload } = action as ProcessWearablesAction
        payload.wearables.forEach((w) => {
          if (state.profileWearables[w.id]) {
            state.profileWearables[w.id].state = 'processed'
          }
        })
      }
      break
    case STOP_WEARABLES_PORTABLE_EXPERENCE:
      {
        const { payload } = action as StopWearablesPortableExperienceAction
        state.wearablesWithPortableExperiences = state.wearablesWithPortableExperiences.filter(
          (w) => !payload.wearables.includes(w)
        )
      }
      break
    case START_WEARABLES_PORTABLE_EXPERENCE:
      {
        const { payload } = action as StartWearablesPortableExperienceAction
        state.wearablesWithPortableExperiences = state.wearablesWithPortableExperiences.concat(
          payload.wearables.map((w) => w.id)
        )
      }
      break
  }

  return state
}
