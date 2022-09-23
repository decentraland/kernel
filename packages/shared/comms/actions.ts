import { IslandChangedMessage } from 'shared/protocol/kernel/comms/v3/archipelago.gen'
import { action } from 'typesafe-actions'
import type { CommsContext } from './context'
import { IBff } from './types'

export const SET_COMMS_ISLAND = '[COMMS] setCommsIsland'
export const setCommsIsland = (island: string | undefined) => action(SET_COMMS_ISLAND, { island })
export type SetCommsIsland = ReturnType<typeof setCommsIsland>

export const SET_WORLD_CONTEXT = '[COMMS] setWorldContext'
export const setWorldContext = (context: CommsContext | undefined) => action(SET_WORLD_CONTEXT, context)
export type SetWorldContextAction = ReturnType<typeof setWorldContext>

export const HANDLE_COMMS_DISCONNECTION = '[COMMS] handleCommsDisconnection'
export const handleCommsDisconnection = (context: CommsContext) => action(HANDLE_COMMS_DISCONNECTION, { context })
export type HandleCommsDisconnection = ReturnType<typeof handleCommsDisconnection>

// this action is triggered by the IBff, it is used to connect a comms adapter
export const CONNECT_TO_COMMS = '[COMMS] ConnectTo'
export const connectToComms = (event: IslandChangedMessage) => action(CONNECT_TO_COMMS, { event })
export type ConnectToCommsAction = ReturnType<typeof connectToComms>

// this action is triggered by the user when changing servers/realm
export const SET_BFF = '[COMMS] setBff'
export const setBff = (context: IBff | undefined) => action(SET_BFF, context)
export type SetBffAction = ReturnType<typeof setBff>

export const HANDLE_BFF_DISCONNECTION = '[COMMS] handleBffDisconnection'
export const handleBffDisconnection = (context: IBff) => action(HANDLE_BFF_DISCONNECTION, { context })
export type HandleBffDisconnection = ReturnType<typeof handleBffDisconnection>
