import { IslandChangedMessage } from '@dcl/protocol/out-ts/decentraland/kernel/comms/v3/archipelago.gen'
import { action } from 'typesafe-actions'
import { IBff } from './types'

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
