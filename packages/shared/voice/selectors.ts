import { RootVoiceState } from './types'

export const getClient = (store: RootVoiceState) => store.voice.client
export const getReconnectTimes = (store: RootVoiceState) => store.voice.reconnectTimes
export const getRemoteStreams = (store: RootVoiceState) => store.voice.remoteStreams
