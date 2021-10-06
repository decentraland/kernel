import { Client, RemoteStream, LocalStream } from 'ion-sdk-js'
import { action } from 'typesafe-actions'
import { IonSFUJSONRPCSignal } from 'ion-sdk-js/lib/signal/json-rpc-impl'

export const VOICE_INITIALIZED = 'Voice Initialized'
export const voiceInitialized = (signal: IonSFUJSONRPCSignal, client: Client) => action(VOICE_INITIALIZED, { client, signal })
export type VoiceInitialized = ReturnType<typeof voiceInitialized>

export const RECONNECT_VOICE = 'Reconnect voice'
export const reconnectVoice = () => action(RECONNECT_VOICE)
export type ReconnectVoice = ReturnType<typeof reconnectVoice>

export const SET_LOCAL_STREAM = 'Set local stream'
export const setLocalStream = (stream: LocalStream) => action(SET_LOCAL_STREAM, { stream })
export type SetLocalStream = ReturnType<typeof setLocalStream>

export const ADD_REMOTE_STREAM = 'Add remote stream'
export const addRemoteStream = (stream: RemoteStream) => action(ADD_REMOTE_STREAM, { stream })
export type AddRemoteStream = ReturnType<typeof addRemoteStream>

export const REMOVE_REMOTE_STREAM = 'Remove remote stream'
export const removeRemoteStream = (streamId: string) => action(REMOVE_REMOTE_STREAM, { streamId })
export type RemoveRemoteStream = ReturnType<typeof removeRemoteStream>

export const START_LOCAL_STREAM = 'Start local stream'
export const startLocalStream = () => action(START_LOCAL_STREAM)
export type StartLocalStream = ReturnType<typeof startLocalStream>

export type VoiceActions =
  | VoiceInitialized
  | ReconnectVoice
  | SetLocalStream
  | AddRemoteStream
  | RemoveRemoteStream
  | StartLocalStream
