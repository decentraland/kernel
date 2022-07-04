import { CRDTServiceDefinition, PingPongServiceDefinition } from './proto/RendererProtocol.gen'
import * as codegen from '@dcl/rpc/dist/codegen'

export type RendererProtocol = {
  crdtService: codegen.RpcClientModule<CRDTServiceDefinition, any>
  pingService: codegen.RpcClientModule<PingPongServiceDefinition, any>
}
