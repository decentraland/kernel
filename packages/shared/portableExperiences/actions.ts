import { StorePortableExperience } from 'shared/types'
import { action } from 'typesafe-actions'

export const DENY_PORTABLE_EXPERIENCES = '[PX] SetDenyList'
export const denyPortableExperiences = (urnList: string[]) => action(DENY_PORTABLE_EXPERIENCES, { urnList })
export type DenyPortableExperiencesAction = ReturnType<typeof denyPortableExperiences>

export const ADD_DEBUG_PX = '[PX] AddDebugPx'
export const addDebugPortableExperience = (data: StorePortableExperience) => action(ADD_DEBUG_PX, { data })
export type AddDebugPortableExperienceAction = ReturnType<typeof addDebugPortableExperience>

export const REMOVE_DEBUG_PX = '[PX] RemoveDebugPx'
export const removeDebugPortableExperience = (urn: string) => action(REMOVE_DEBUG_PX, { urn })
export type RemoveDebugPortableExperienceAction = ReturnType<typeof removeDebugPortableExperience>
