import { CRDTServiceDefinition } from '@dcl/protocol/out-ts/decentraland/renderer/crdt.gen'
import { EmotesRendererServiceDefinition } from '@dcl/protocol/out-ts/decentraland/renderer/emotes.gen'
import * as codegen from '@dcl/rpc/dist/codegen'

export type RendererProtocol = {
  crdtService: codegen.RpcClientModule<CRDTServiceDefinition, any>
  emotesService: codegen.RpcClientModule<EmotesRendererServiceDefinition, any>
}
