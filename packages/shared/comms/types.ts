import type { VoiceCommunicator } from 'voice-chat-codec/VoiceCommunicator'
import type { CommsContext } from './context'

export type CommsState = {
  initialized: boolean
  voiceChatRecording: boolean
  voicePolicy: VoicePolicy
  island?: string
  voiceCommunicator?: VoiceCommunicator
  context: CommsContext | undefined
}

export type CommsConnectionState =
  | 'initial'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'realm-full'
  | 'reconnection-error'
  | 'id-taken'
  | 'disconnecting'

export type CommsStatus = {
  status: CommsConnectionState
  connectedPeers: number
}

export type RootCommsState = {
  comms: CommsState
}

export enum VoicePolicy {
  ALLOW_ALL,
  ALLOW_VERIFIED_ONLY,
  ALLOW_FRIENDS_ONLY
}

// These types appear to be unavailable when compiling for some reason, so we add them here

type RTCIceCredentialType = 'password'

export interface RTCIceServer {
  credential?: string
  credentialType?: RTCIceCredentialType
  urls: string | string[]
  username?: string
}
