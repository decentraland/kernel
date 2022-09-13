import { RpcClientPort } from '@dcl/rpc'
import * as codegen from '@dcl/rpc/dist/codegen'
import { TeleportServiceDefinition } from '../proto/Teleport.gen'

export function registerTeleportService<Context>(
  clientPort: RpcClientPort
): codegen.RpcClientModule<TeleportServiceDefinition, Context> {
  return codegen.loadService<Context, TeleportServiceDefinition>(clientPort, TeleportServiceDefinition)
}
