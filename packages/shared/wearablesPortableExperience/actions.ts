import { action } from 'typesafe-actions'
import { PartialWearableV2, WearableId } from '../catalogs/types'

export const UPDATE_WEARABLES = '[Update] Wearables'
export const updateWearables = (wearablesToAdd: WearableId[], wearablesToRemove: WearableId[]) =>
  action(UPDATE_WEARABLES, { wearablesToAdd, wearablesToRemove })
export type UpdateWearablesAction = ReturnType<typeof updateWearables>

export const PROCESS_WEARABLES = '[Process] Wearables'
export const processWearables = (wearables: PartialWearableV2[]) => action(PROCESS_WEARABLES, { wearables })
export type ProcessWearablesAction = ReturnType<typeof processWearables>

export const START_WEARABLES_PORTABLE_EXPERENCE = '[Start] Wearable Portable Experience'
export const startWearablesPortableExperience = (wearables: PartialWearableV2[]) =>
  action(START_WEARABLES_PORTABLE_EXPERENCE, { wearables })
export type StartWearablesPortableExperienceAction = ReturnType<typeof startWearablesPortableExperience>

export const STOP_WEARABLES_PORTABLE_EXPERENCE = '[Stop] Wearable Portable Experience'
export const stopWearablesPortableExperience = (wearables: WearableId[]) =>
  action(STOP_WEARABLES_PORTABLE_EXPERENCE, { wearables })
export type StopWearablesPortableExperienceAction = ReturnType<typeof stopWearablesPortableExperience>
