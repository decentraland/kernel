export type VoiceChatState = {
  recording: boolean
  requestRecording: boolean
  policy: VoicePolicy
  voiceHandler: any | null
  error: string | null
  media?: any
  volume: number
  mute: boolean
  liveKit?: {
    room: any
    token: string
  }
}

export enum VoicePolicy {
  ALLOW_ALL,
  ALLOW_VERIFIED_ONLY,
  ALLOW_FRIENDS_ONLY
}

export type RootVoiceChatState = {
  voiceChat: VoiceChatState
}
