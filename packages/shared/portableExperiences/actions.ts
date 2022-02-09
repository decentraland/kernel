import { action } from 'typesafe-actions'

export const DENY_PORTABLE_EXPERIENCES = '[PX] SetDenyList'
export const denyPortableExperiences = (urnList: string[]) => action(DENY_PORTABLE_EXPERIENCES, { urnList })
export type DenyPortableExperiencesAction = ReturnType<typeof denyPortableExperiences>
