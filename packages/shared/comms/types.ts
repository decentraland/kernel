import type { VoiceCommunicator } from 'voice-chat-codec/VoiceCommunicator'

export type CommsState = {
  initialized: boolean
  voiceChatRecording: boolean
  voicePolicy: VoicePolicy
  island?: string
  preferedIsland?: string
  voiceCommunicator?: VoiceCommunicator
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
