import { RpcClientPort } from '@dcl/rpc'
import * as codegen from '@dcl/rpc/dist/codegen'
import { EmotesRendererServiceDefinition } from '@dcl/protocol/out-ts/decentraland/renderer/renderer_services/emotes_renderer.gen'

export function registerEmotesService<Context>(
  clientPort: RpcClientPort
): codegen.RpcClientModule<EmotesRendererServiceDefinition, Context> {
  return codegen.loadService<Context, EmotesRendererServiceDefinition>(clientPort, EmotesRendererServiceDefinition)
}
