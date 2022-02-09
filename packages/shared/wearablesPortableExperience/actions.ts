import { StorePortableExperience } from 'shared/types'
import { action } from 'typesafe-actions'
import { PartialWearableV2, WearableId } from '../catalogs/types'

export const UPDATE_WEARABLES = '[Update] Wearables'
export const updateWearables = (wearablesToAdd: WearableId[], wearablesToRemove: WearableId[]) =>
  action(UPDATE_WEARABLES, { wearablesToAdd, wearablesToRemove })
export type UpdateWearablesAction = ReturnType<typeof updateWearables>

export const PROCESS_WEARABLES = '[Process] Wearables'
export const processWearables = (wearables: PartialWearableV2[]) => action(PROCESS_WEARABLES, { wearables })
export type ProcessWearablesAction = ReturnType<typeof processWearables>

export const ADD_DESIRED_PORTABLE_EXPERIENCE = '[WearablesPX] Add desired PX'
export const addDesiredPortableExperience = (data: StorePortableExperience) =>
  action(ADD_DESIRED_PORTABLE_EXPERIENCE, { data })
export type AddDesiredPortableExperienceAction = ReturnType<typeof addDesiredPortableExperience>

export const REMOVE_DESIRED_PORTABLE_EXPERIENCE = '[WearablesPX] Remove desired PX'
export const removeDesiredPortableExperience = (id: string) => action(REMOVE_DESIRED_PORTABLE_EXPERIENCE, { id })
export type RemoveDesiredPortableExperienceAction = ReturnType<typeof removeDesiredPortableExperience>
