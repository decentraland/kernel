import { StorePortableExperience } from 'shared/types'
import { WearableId } from '../../shared/catalogs/types'

export type WearablesPortableExperienceData = {
  state: 'pending' | 'processed'
}

export type WearablesPortableExperienceState = {
  profileWearables: Record<WearableId, WearablesPortableExperienceData>
  wearablesWithPortableExperiences: WearableId[]
  desiredWearablePortableExperiences: Record<string, StorePortableExperience>
}

export type RootWearablesPortableExperienceState = {
  wearablesPortableExperiences: WearablesPortableExperienceState
}
