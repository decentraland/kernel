import { Position } from './utils'
import {
  UserInformation,
  Package,
  ChatMessage,
  ProfileVersion,
  BusMessage,
  VoiceFragment,
  ProfileResponse,
  ProfileRequest
} from './types'
import { Stats } from '../debug'
import { Profile } from 'shared/types'
import { EncodedFrame } from 'voice-chat-codec/types'

export type CommsEvents = {
}

export interface WorldInstanceConnection { // extends Emitter<CommsEvents> {
  stats: Stats | null

  // handlers
  sceneMessageHandler: (data: Package<BusMessage>) => void
  chatHandler: (data: Package<ChatMessage>) => void
  profileHandler: (data: Package<ProfileVersion>) => void
  positionHandler: (data: Package<Position>) => void
  voiceHandler: (data: Package<VoiceFragment>) => void
  profileResponseHandler: (data: Package<ProfileResponse>) => void
  profileRequestHandler: (data: Package<ProfileRequest>) => void

  // TODO - review metrics API - moliva - 19/12/2019
  readonly ping: number
  analyticsData(): Record<string, any>

  disconnect(): Promise<void>

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

  connect(): Promise<boolean>
}
