import { Package } from './types'
import * as proto from 'shared/protocol/kernel/comms/comms-rfc-4.gen'
import { Emitter } from 'mitt'

export type CommsDisconnectionEvent = {
  kicked: boolean
}
export type CommsPeerDisconnectedEvent = {
  address: string
}

export type CommsEvents = {
  // RFC4 messages
  sceneMessageBus: Package<proto.Scene>
  chatMessage: Package<proto.Chat>
  profileMessage: Package<proto.AnnounceProfileVersion>
  position: Package<proto.Position>
  voiceMessage: Package<proto.Voice>
  profileResponse: Package<proto.ProfileResponse>
  profileRequest: Package<proto.ProfileRequest>

  // Transport messages
  PEER_DISCONNECTED: CommsPeerDisconnectedEvent
  DISCONNECTION: CommsDisconnectionEvent
}

export interface RoomConnection {
  // this operation is non-reversible
  disconnect(): Promise<void>
  // @once
  connect(): Promise<void>

  events: Emitter<CommsEvents>

  sendProfileMessage(profile: proto.AnnounceProfileVersion): Promise<void>
  sendProfileRequest(request: proto.ProfileRequest): Promise<void>
  sendProfileResponse(response: proto.ProfileResponse): Promise<void>
  sendPositionMessage(position: Omit<proto.Position, 'index'>): Promise<void>
  sendParcelSceneMessage(message: proto.Scene): Promise<void>
  sendChatMessage(message: proto.Chat): Promise<void>
  sendVoiceMessage(message: proto.Voice): Promise<void>
}

export type CommsTransportEvents = Pick<CommsEvents, 'DISCONNECTION' | 'PEER_DISCONNECTED'> & {
  message: TransportMessage
}

export type TransportMessage = {
  data: Uint8Array
  senderAddress: string
}

export interface ICommsTransport {
  events: Emitter<CommsTransportEvents>
  send(data: Uint8Array, reliable: boolean): void
  disconnect(): Promise<void>
  connect(): Promise<void>
}
