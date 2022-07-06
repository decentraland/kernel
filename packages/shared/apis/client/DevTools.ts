import * as codegen from '@dcl/rpc/dist/codegen'
import type { RpcClientPort } from '@dcl/rpc/dist/types'
import { DevToolsServiceDefinition } from './../proto/DevTools.gen'

export function createDevToolsServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = codegen.loadService<Context, DevToolsServiceDefinition>(clientPort, DevToolsServiceDefinition)

  return originalService
}
