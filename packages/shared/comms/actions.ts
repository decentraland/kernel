import { action } from 'typesafe-actions'
import { RoomConnection } from './interface'

export const SET_COMMS_ISLAND = '[COMMS] setCommsIsland'
export const setCommsIsland = (island: string | undefined) => action(SET_COMMS_ISLAND, { island })
export type SetCommsIsland = ReturnType<typeof setCommsIsland>

export const SET_WORLD_CONTEXT = '[COMMS] setWorldContext'
export const setRoomConnection = (room: RoomConnection | undefined) => action(SET_WORLD_CONTEXT, room)
export type SetWorldContextAction = ReturnType<typeof setRoomConnection>

export const HANDLE_ROOM_DISCONNECTION = '[COMMS] handleRoomDisconnection'
export const handleRoomDisconnection = (room: RoomConnection) => action(HANDLE_ROOM_DISCONNECTION, { context: room })
export type HandleRoomDisconnection = ReturnType<typeof handleRoomDisconnection>
