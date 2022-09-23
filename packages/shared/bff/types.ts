import { RpcClientModule } from '@dcl/rpc/dist/codegen'
import { Emitter } from 'mitt'
import { Realm } from 'shared/dao/types'
import { CommsServiceDefinition } from 'shared/protocol/bff/comms-service.gen'
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

export type BffServices<CallContext = {}> = {
  comms: RpcClientModule<CommsServiceDefinition, CallContext>
  legacy: LegacyServices
}

export interface IBff<CallContext = {}> {
  readonly realm: Realm
  disconnect(error?: Error): Promise<void>
  events: Emitter<BffEvents>
  services: BffServices<CallContext>
}
