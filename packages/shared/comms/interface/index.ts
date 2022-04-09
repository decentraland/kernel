import { Position } from './utils'
import {
  UserInformation,
  ChatMessage,
  ProfileVersion,
  BusMessage,
  VoiceFragment,
  ProfileResponse,
  ProfileRequest,
  Package
} from './types'
import { Stats } from '../debug'
import { Profile } from 'shared/types'
import { EncodedFrame } from 'voice-chat-codec/types'
import { Emitter } from 'mitt'

export type CommsEvents = {
  initialMessage: Package<UserInformation>
  sceneMessageBus: Package<BusMessage>
  chatMessage: Package<ChatMessage>
  profileMessage: Package<ProfileVersion>
  position: Package<Position>
  voiceMessage: Package<VoiceFragment>

  // move the following to GlobalMessages+RPC instead of RoomConnection
  profileResponse: Package<ProfileResponse>
  profileRequest: Package<ProfileRequest>

  DISCONNECTION: {}
}

export interface RoomConnection {
  // this operation is non-reversible
  disconnect(): Promise<void>
  // @once
  connect(): Promise<boolean>

  stats: Stats | null

  events: Emitter<CommsEvents>

  // TODO - review metrics API - moliva - 19/12/2019
  readonly ping: number

  sendInitialMessage(userInfo: UserInformation): Promise<void>
  sendProfileMessage(currentPosition: Position, userInfo: UserInformation): Promise<void>
  sendProfileRequest(currentPosition: Position, userId: string, version: number | undefined): Promise<void>
  sendProfileResponse(currentPosition: Position, profile: Profile): Promise<void>
  sendPositionMessage(p: Position): Promise<void>
  sendParcelUpdateMessage(currentPosition: Position, p: Position): Promise<void>
  sendParcelSceneCommsMessage(cid: string, message: string): Promise<void>
  sendChatMessage(currentPosition: Position, messageId: string, text: string): Promise<void>
  sendVoiceMessage(currentPosition: Position, frame: EncodedFrame): Promise<void>

  setTopics(topics: string[]): Promise<void>
}
