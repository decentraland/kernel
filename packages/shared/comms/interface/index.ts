import { UserInformation, Package } from './types'
import * as proto from '../comms-rfc-4.gen'
import { Emitter } from 'mitt'

export type CommsEvents = {
  initialMessage: Package<UserInformation>
  sceneMessageBus: Package<proto.Scene>
  chatMessage: Package<proto.Chat>
  profileMessage: Package<proto.AnnounceProfileVersion>
  position: Package<proto.Position>
  voiceMessage: Package<proto.Voice>
  profileResponse: Package<proto.ProfileResponse>
  profileRequest: Package<proto.ProfileRequest>

  DISCONNECTION: any
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
