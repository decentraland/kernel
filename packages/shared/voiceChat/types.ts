export type VoiceChatState = {
  recording: boolean
  requestRecording: boolean
  policy: VoicePolicy
  voiceHandler: any | undefined
  volume: number
  mute: boolean
}

export enum VoicePolicy {
  ALLOW_ALL,
  ALLOW_VERIFIED_ONLY,
  ALLOW_FRIENDS_ONLY
}

export type RootVoiceChatState = {
  voiceChat: VoiceChatState
}
