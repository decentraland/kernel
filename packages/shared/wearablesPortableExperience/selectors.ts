import { WearableId } from '../catalogs/types'
import { RootWearablesPortableExperienceState } from './types'

export const getCurrentWearables = (store: RootWearablesPortableExperienceState): WearableId[] =>
  Object.keys(store.wearablesPortableExperiences.profileWearables)

export const getPendingWearables = (store: RootWearablesPortableExperienceState): WearableId[] =>
  Object.entries(store.wearablesPortableExperiences.profileWearables)
    .filter(([, data]) => data.state === 'pending')
    .map(([id]) => id)

export const isRunningPortableExperience = (
  store: RootWearablesPortableExperienceState,
  wearable: WearableId
): boolean => store.wearablesPortableExperiences.wearablesWithPortableExperiences.includes(wearable)
