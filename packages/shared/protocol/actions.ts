import { action } from 'typesafe-actions'
import { CommsContext } from '../comms/context'

export const SET_WORLD_CONTEXT = 'Set world connection context'
export const setWorldContext = (context: CommsContext | undefined) => action(SET_WORLD_CONTEXT, context)
export type SetWorldContextAction = ReturnType<typeof setWorldContext>

export const BEFORE_UNLOAD = 'BEFORE_UNLOAD'
export const beforeUnloadAction = () => action(BEFORE_UNLOAD)

export const ANNOUNCE_PROFILE = '[Request] Announce profile to nearby users'
export const announceProfile = (userId: string, version: number) => action(ANNOUNCE_PROFILE, { userId, version })
export type AnnounceProfileAction = ReturnType<typeof announceProfile>
