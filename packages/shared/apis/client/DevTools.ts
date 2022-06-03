import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { DevToolsServiceDefinition } from './../gen/DevTools'

export async function createDevToolsServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = await codegen.loadService<Context, DevToolsServiceDefinition>(
    clientPort,
    DevToolsServiceDefinition
  )

  return originalService
}
