import type { Avatar } from '@dcl/schemas'
import { NewProfileForRenderer } from 'shared/profiles/transformations/types'
import type { ProfileType } from 'shared/profiles/types'

export const enum AvatarMessageType {
  // Networking related messages
  USER_DATA = 'USER_DATA',
  USER_VISIBLE = 'USER_VISIBLE',
  USER_EXPRESSION = 'USER_EXPRESSION',
  USER_REMOVED = 'USER_REMOVED',
  USER_TALKING = 'USER_TALKING',

  // TODO(mendez): what emits this messages?
  // Actions related messages
  USER_MUTED = 'USER_MUTED',
  USER_UNMUTED = 'USER_UNMUTED',
  USER_BLOCKED = 'USER_BLOCKED',
  USER_UNBLOCKED = 'USER_UNBLOCKED'
}

export type ReceiveUserExpressionMessage = {
  type: AvatarMessageType.USER_EXPRESSION
  userId: string
  expressionId: string
  timestamp: number
}

export type ReceiveUserDataMessage = {
  type: AvatarMessageType.USER_DATA
  userId: string
  data: Partial<UserInformation>
  profile: NewProfileForRenderer
}

export type ReceiveUserVisibleMessage = {
  type: AvatarMessageType.USER_VISIBLE
  userId: string
  visible: boolean
}

export type ReceiveUserTalkingMessage = {
  type: AvatarMessageType.USER_TALKING
  userId: string
  talking: boolean
}

export type UserRemovedMessage = {
  type: AvatarMessageType.USER_REMOVED
  userId: string
}

export type UserMessage = {
  type:
    | AvatarMessageType.USER_BLOCKED
    | AvatarMessageType.USER_UNBLOCKED
    | AvatarMessageType.USER_MUTED
    | AvatarMessageType.USER_UNMUTED
    | AvatarMessageType.USER_TALKING
  userId: string
}

export type AvatarMessage =
  | ReceiveUserDataMessage
  | ReceiveUserVisibleMessage
  | ReceiveUserExpressionMessage
  | UserRemovedMessage
  | UserMessage
  | ReceiveUserTalkingMessage

export type UUID = string

/**
 * This type contains information about the peers, the AvatarEntity must accept this whole object in setAttributes(obj).
 */
export type PeerInformation = UserInformation & {
  /**
   * Unique peer ID
   */
  uuid: UUID
  talking: boolean
  lastPositionUpdate: number
  lastProfileUpdate: number
  lastUpdate: number
  receivedPublicChatMessages: Set<string>
}

export type UserInformation = {
  profileType?: ProfileType
  ethereumAddress?: string
  expression?: AvatarExpression
  position?: Pose
  profile?: NewProfileForRenderer
  visible?: boolean
}

export type AvatarExpression = {
  expressionType: string
  expressionTimestamp: number
}

// The order is [X,Y,Z,Qx,Qy,Qz,Qw,immediate]
export type Pose = [number, number, number, number, number, number, number, boolean]

export type PoseInformation = {
  v: Pose
}

export type PackageType = 'profile' | 'chat' | 'position' | 'voice' | 'profileRequest' | 'profileResponse'

export type Package<T> = {
  sender: string
  time: number
  data: T
}

export type ProfileVersion = {
  version: string
  user: string
  type: ProfileType
}

export type ChatMessage = {
  id: string
  text: string
}

export type VoiceFragment = {
  index: number
  encoded: Uint8Array
}

export type ProfileRequest = {
  userId: string
  version?: string
}

export type ProfileResponse = {
  profile: Avatar
}

export type BusMessage = ChatMessage

export class ConnectionEstablishmentError extends Error {
  constructor(message: string) {
    super(message)
  }
}
export class UnknownCommsModeError extends Error {
  constructor(message: string) {
    super(message)
  }
}
