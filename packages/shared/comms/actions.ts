import { action } from 'typesafe-actions'
import type { CommsContext } from './context'

export const SET_COMMS_ISLAND = '[COMMS] setCommsIsland'
export const setCommsIsland = (island: string | undefined) => action(SET_COMMS_ISLAND, { island })
export type SetCommsIsland = ReturnType<typeof setCommsIsland>

export const SET_WORLD_CONTEXT = '[COMMS] setWorldContext'
export const setWorldContext = (context: CommsContext | undefined) => action(SET_WORLD_CONTEXT, context)
export type SetWorldContextAction = ReturnType<typeof setWorldContext>

export const HANDLE_COMMS_DISCONNECTION = '[COMMS] handleCommsDisconnection'
export const handleCommsDisconnection = (context: CommsContext) => action(HANDLE_COMMS_DISCONNECTION, { context })
export type HandleCommsDisconnection = ReturnType<typeof handleCommsDisconnection>
