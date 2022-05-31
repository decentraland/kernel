import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { EngineAPIServiceDefinition } from '../gen/EngineAPI'

export async function createEngineAPIServiceClient<Context>(clientPort: RpcClientPort) {
  const realService = await codegen.loadService<Context, EngineAPIServiceDefinition>(
    clientPort,
    EngineAPIServiceDefinition
  )
  return realService
}
