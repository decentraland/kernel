import { CRDTServiceDefinition } from '@dcl/protocol/out-ts/decentraland/renderer/protocol.gen'
import * as codegen from '@dcl/rpc/dist/codegen'

export type RendererProtocol = {
  crdtService: codegen.RpcClientModule<CRDTServiceDefinition, any>
}
