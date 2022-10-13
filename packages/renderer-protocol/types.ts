import { CRDTServiceDefinition } from 'shared/protocol/decentraland/renderer/protocol.gen'
import * as codegen from '@dcl/rpc/dist/codegen'

export type RendererProtocol = {
  crdtService: codegen.RpcClientModule<CRDTServiceDefinition, any>
}
