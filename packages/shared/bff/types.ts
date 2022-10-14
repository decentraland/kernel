import { RpcClientModule } from '@dcl/rpc/dist/codegen'
import { Emitter } from 'mitt'
import { CommsServiceDefinition } from '@dcl/protocol/out-ts/decentraland/bff/comms_service.gen'
import { AboutResponse } from '@dcl/protocol/out-ts/decentraland/bff/http_endpoints.gen'
import { IslandChangedMessage } from '@dcl/protocol/out-ts/decentraland/kernel/comms/v3/archipelago.gen'

export type BffState = {
  bff: IBff | undefined
}

export type RootBffState = {
  bff: BffState
}

export type BffEvents = {
  DISCONNECTION: { error?: Error }
  setIsland: IslandChangedMessage
}

export type LegacyServices = {
  fetchContentServer: string
  lambdasServer: string
  updateContentServer: string
  hotScenesService: string
  exploreRealmsService: string
  poiService: string
}

export type BffServices<CallContext = any> = {
  comms: RpcClientModule<CommsServiceDefinition, CallContext>
  legacy: LegacyServices
}

export interface IBff<CallContext = any> {
  readonly about: AboutResponse
  readonly baseUrl: string
  disconnect(error?: Error): Promise<void>
  events: Emitter<BffEvents>
  services: BffServices<CallContext>
}
