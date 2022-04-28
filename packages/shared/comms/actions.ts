import { action } from 'typesafe-actions'
import type { VoiceCommunicator } from 'voice-chat-codec/VoiceCommunicator'
import type { CommsContext } from './context'
import type { VoicePolicy } from './types'

export const VOICE_PLAYING_UPDATE = '[COMMS] voicePlayingUpdate'
export const voicePlayingUpdate = (userId: string, playing: boolean) =>
  action(VOICE_PLAYING_UPDATE, { userId, playing })
export type VoicePlayingUpdate = ReturnType<typeof voicePlayingUpdate>

export const INIT_VOICE_COMMUNICATOR = '[COMMS] setVoiceCommunicator'
export const setVoiceCommunicator = (voiceCommunicator: VoiceCommunicator) =>
  action(INIT_VOICE_COMMUNICATOR, { voiceCommunicator })

/**
 * Action to trigger voice chat recording
 */
export const SET_VOICE_CHAT_RECORDING = '[COMMS] setVoiceChatRecording'
export const setVoiceChatRecording = (recording: boolean) => action(SET_VOICE_CHAT_RECORDING, { recording })
export type SetVoiceChatRecording = ReturnType<typeof setVoiceChatRecording>

/**
 * Action to toggle voice chat recording
 */
export const TOGGLE_VOICE_CHAT_RECORDING = '[COMMS] toggleVoiceChatRecording'
export const toggleVoiceChatRecording = () => action(TOGGLE_VOICE_CHAT_RECORDING)
export type ToggleVoiceChatRecording = ReturnType<typeof toggleVoiceChatRecording>

/**
 * Action triggered when recording starts or stops
 */
export const VOICE_RECORDING_UPDATE = '[COMMS] voiceRecordingUpdate'
export const voiceRecordingUpdate = (recording: boolean) => action(VOICE_RECORDING_UPDATE, { recording })
export type VoiceRecordingUpdate = ReturnType<typeof voiceRecordingUpdate>

export const SET_VOICE_VOLUME = '[COMMS] setVoiceVolume'
export const setVoiceVolume = (volume: number) => action(SET_VOICE_VOLUME, { volume })
export type SetVoiceVolume = ReturnType<typeof setVoiceVolume>

export const SET_VOICE_MUTE = '[COMMS] setVoiceMute'
export const setVoiceMute = (mute: boolean) => action(SET_VOICE_MUTE, { mute })
export type SetVoiceMute = ReturnType<typeof setVoiceMute>

export const SET_VOICE_POLICY = '[COMMS] setVoicePolicy'
export const setVoicePolicy = (voicePolicy: VoicePolicy) => action(SET_VOICE_POLICY, { voicePolicy })
export type SetVoicePolicy = ReturnType<typeof setVoicePolicy>

export const SET_COMMS_ISLAND = '[COMMS] setCommsIsland'
export const setCommsIsland = (island: string | undefined) => action(SET_COMMS_ISLAND, { island })
export type SetCommsIsland = ReturnType<typeof setCommsIsland>

export const SET_WORLD_CONTEXT = '[COMMS] setWorldContext'
export const setWorldContext = (context: CommsContext | undefined) => action(SET_WORLD_CONTEXT, context)
export type SetWorldContextAction = ReturnType<typeof setWorldContext>

export const HANDLE_COMMS_DISCONNECTION = '[COMMS] handleCommsDisconnection'
export const handleCommsDisconnection = (context: CommsContext) => action(HANDLE_COMMS_DISCONNECTION, { context })
export type HandleCommsDisconnection = ReturnType<typeof handleCommsDisconnection>
