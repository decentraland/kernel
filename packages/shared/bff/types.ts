import { RpcClientModule } from '@dcl/rpc/dist/codegen'
import { Emitter } from 'mitt'
import { CommsServiceDefinition } from 'shared/protocol/bff/comms-service.gen'
import { AboutResponse } from 'shared/protocol/bff/http-endpoints.gen'
import { IslandChangedMessage } from 'shared/protocol/kernel/comms/v3/archipelago.gen'

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
  catalystServer: string
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
