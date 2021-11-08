import { WearableId } from '../../shared/catalogs/types'

export type WearablesPortableExperienceData = {
  state: 'pending' | 'processed'
}

export type WearablesPortableExperienceState = {
  profileWearables: Record<WearableId, WearablesPortableExperienceData>
  wearablesWithPortableExperiences: WearableId[]
}

export type RootWearablesPortableExperienceState = {
  wearablesPortableExperiences: WearablesPortableExperienceState
}
