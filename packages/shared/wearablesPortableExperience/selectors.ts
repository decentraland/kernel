import { StorePortableExperience } from 'shared/types'
import { RootWearablesPortableExperienceState } from './types'

export const getDesiredWearablePortableExpriences = (store: RootWearablesPortableExperienceState) =>
  store.wearablesPortableExperiences.desiredWearablePortableExperiences

export const getDesiredLoadableWearablePortableExpriences = (
  store: RootWearablesPortableExperienceState
): StorePortableExperience[] =>
  Object.values(store.wearablesPortableExperiences.desiredWearablePortableExperiences).filter(
    Boolean
  ) as StorePortableExperience[]
