import { loadService } from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { EngineAPIServiceDefinition } from './gen/EngineAPI'

export const createEngineAPIServiceClient = <Context>(clientPort: RpcClientPort) =>
  loadService<Context, EngineAPIServiceDefinition>(clientPort, EngineAPIServiceDefinition)
