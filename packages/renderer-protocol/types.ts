import { CRDTServiceDefinition } from './proto/CRDT.gen'
import { TeleportServiceDefinition } from './proto/Teleport.gen'
import * as codegen from '@dcl/rpc/dist/codegen'

export type RendererProtocol = {
  crdtService: codegen.RpcClientModule<CRDTServiceDefinition, any>
  teleportService: codegen.RpcClientModule<TeleportServiceDefinition, any>
}
