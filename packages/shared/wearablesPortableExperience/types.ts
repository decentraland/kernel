import { StorePortableExperience } from 'shared/types'

export type WearablesPortableExperienceState = {
  desiredWearablePortableExperiences: Record<string, StorePortableExperience | null>
}

export type RootWearablesPortableExperienceState = {
  wearablesPortableExperiences: WearablesPortableExperienceState
}
