import { CRDTServiceDefinition } from 'shared/protocol/renderer-protocol/RendererProtocol.gen'
import * as codegen from '@dcl/rpc/dist/codegen'

export type RendererProtocol = {
  crdtService: codegen.RpcClientModule<CRDTServiceDefinition, any>
}
