import { RpcClientModule } from '@dcl/rpc/dist/codegen'
import { Emitter } from 'mitt'
import { CommsServiceDefinition } from 'shared/protocol/bff/comms-service.gen'
import { IslandChangedMessage } from 'shared/protocol/kernel/comms/v3/archipelago.gen'
import type { CommsContext } from './context'

export type CommsState = {
  initialized: boolean
  island?: string
  context: CommsContext | undefined
  bff: IBff | undefined
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
// These types appear to be unavailable when compiling for some reason, so we add them here

type RTCIceCredentialType = 'password'

export interface RTCIceServer {
  credential?: string
  credentialType?: RTCIceCredentialType
  urls: string | string[]
  username?: string
}

export type BffEvents = {
  DISCONNECTION: { error?: Error }
  setIsland: IslandChangedMessage
}

export type BffServices<CallContext = {}> = {
  comms: RpcClientModule<CommsServiceDefinition, CallContext>
}

export interface IBff<CallContext = {}> {
  disconnect(error?: Error): Promise<void>
  events: Emitter<BffEvents>
  services: BffServices<CallContext>
}
