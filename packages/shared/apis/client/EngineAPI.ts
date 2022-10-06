import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { EngineAPIServiceDefinition } from 'shared/protocol/kernel/apis/EngineAPI.gen'

export function createEngineAPIServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = codegen.loadService<Context, EngineAPIServiceDefinition>(
    clientPort,
    EngineAPIServiceDefinition
  )
  return originalService
}
