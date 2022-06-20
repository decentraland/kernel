import { RpcClientPort } from '@dcl/rpc'
import * as codegen from '@dcl/rpc/dist/codegen'
import { PingPongServiceDefinition } from '../proto/RendererProtocol.gen'

export function registerPingService<Context>(clientPort: RpcClientPort) {
  return codegen.loadService<Context, PingPongServiceDefinition>(clientPort, PingPongServiceDefinition)
}
