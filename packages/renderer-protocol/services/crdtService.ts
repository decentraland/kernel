import { RpcClientPort } from '@dcl/rpc'
import * as codegen from '@dcl/rpc/dist/codegen'
import { CRDTServiceDefinition } from 'shared/protocol/renderer-protocol/RendererProtocol.gen'

export function registerCRDTService<Context>(
  clientPort: RpcClientPort
): codegen.RpcClientModule<CRDTServiceDefinition, Context> {
  return codegen.loadService<Context, CRDTServiceDefinition>(clientPort, CRDTServiceDefinition)
}
