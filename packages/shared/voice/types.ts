import { Client, RemoteStream, LocalStream } from 'ion-sdk-js'
import { IonSFUJSONRPCSignal } from 'ion-sdk-js/lib/signal/json-rpc-impl'

export type VoiceState = {
  connected: boolean
  client?: Client
  signal?: IonSFUJSONRPCSignal
  remoteStreams: RemoteStream[]
  localStream?: LocalStream
  reconnectTimes: number
}

export type RootVoiceState = {
  voice: VoiceState
}
