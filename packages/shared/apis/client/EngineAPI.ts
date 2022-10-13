import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { EngineApiServiceDefinition } from 'shared/protocol/decentraland/kernel/apis/engine_api.gen'

export function createEngineApiServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = codegen.loadService<Context, EngineApiServiceDefinition>(
    clientPort,
    EngineApiServiceDefinition
  )
  return originalService
}
