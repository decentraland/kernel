import { action } from 'typesafe-actions'
import { VoicePolicy } from './types'
import { VoiceHandler } from '../../voice-chat-codec/VoiceChat'

export const JOIN_VOICE_CHAT = '[VC] JoinVoiceChat'
export const joinVoiceChat = () => action(JOIN_VOICE_CHAT, {})
export type JoinVoiceChatAction = ReturnType<typeof joinVoiceChat>

export const LEAVE_VOICE_CHAT = '[VC] LeaveVoiceChat'
export const leaveVoiceChat = () => action(LEAVE_VOICE_CHAT, {})
export type LeaveVoiceChatAction = ReturnType<typeof leaveVoiceChat>

export const VOICE_PLAYING_UPDATE = '[VC] voicePlayingUpdate'
export const voicePlayingUpdate = (userId: string, playing: boolean) =>
  action(VOICE_PLAYING_UPDATE, { userId, playing })
export type VoicePlayingUpdate = ReturnType<typeof voicePlayingUpdate>

export const SET_VOICE_CHAT_HANDLER = '[VC] setVoiceChatHandler'
export const setVoiceChatHandler = (voiceChat: VoiceHandler) => action(SET_VOICE_CHAT_HANDLER, { voiceChat })
export type SetVoiceChatHandlerAction = ReturnType<typeof setVoiceChatHandler>

/**
 * Action to trigger voice chat recording
 */
export const REQUEST_VOICE_CHAT_RECORDING = '[VC] requestVoiceChatRecording'
export const requestVoiceChatRecording = (recording: boolean) => action(REQUEST_VOICE_CHAT_RECORDING, { recording })
export type RequestVoiceChatRecording = ReturnType<typeof requestVoiceChatRecording>

/**
 * Action to toggle voice chat recording
 */
export const REQUEST_TOGGLE_VOICE_CHAT_RECORDING = '[VC] toggleVoiceChatRecording'
export const requestToggleVoiceChatRecording = () => action(REQUEST_TOGGLE_VOICE_CHAT_RECORDING, {})
export type RequestToggleVoiceChatRecording = ReturnType<typeof requestToggleVoiceChatRecording>

/**
 * Action triggered when recording starts or stops
 */
export const VOICE_RECORDING_UPDATE = '[VC] voiceRecordingUpdate'
export const voiceRecordingUpdate = (recording: boolean) => action(VOICE_RECORDING_UPDATE, { recording })
export type VoiceRecordingUpdate = ReturnType<typeof voiceRecordingUpdate>

export const SET_VOICE_CHAT_VOLUME = '[VC] setVoiceChatVolume'
export const setVoiceChatVolume = (volume: number) => action(SET_VOICE_CHAT_VOLUME, { volume })
export type SetVoiceChatVolume = ReturnType<typeof setVoiceChatVolume>

export const SET_VOICE_CHAT_MUTE = '[VC] setVoiceChatMute'
export const setVoiceChatMute = (mute: boolean) => action(SET_VOICE_CHAT_MUTE, { mute })
export type SetVoiceChatMute = ReturnType<typeof setVoiceChatMute>

export const SET_VOICE_CHAT_POLICY = '[VC] setVoiceChatPolicy'
export const setVoiceChatPolicy = (policy: VoicePolicy) => action(SET_VOICE_CHAT_POLICY, { policy })
export type SetVoiceChatPolicy = ReturnType<typeof setVoiceChatPolicy>

export type VoiceChatActions =
  | JoinVoiceChatAction
  | LeaveVoiceChatAction
  | VoicePlayingUpdate
  | SetVoiceChatHandlerAction
  | RequestVoiceChatRecording
  | RequestToggleVoiceChatRecording
  | VoiceRecordingUpdate
  | SetVoiceChatVolume
  | SetVoiceChatMute
  | SetVoiceChatPolicy
