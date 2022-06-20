import { RpcClientPort } from '@dcl/rpc'
import * as codegen from '@dcl/rpc/dist/codegen'
import { CRDTServiceDefinition } from '../proto/RendererProtocol.gen'

export function registerCRDTService<Context>(
  clientPort: RpcClientPort
): codegen.RpcClientModule<CRDTServiceDefinition, Context> {
  return codegen.loadService<Context, CRDTServiceDefinition>(clientPort, CRDTServiceDefinition)
}

// export function registerCRDTService2<Context>(clientPort: RpcClientPort) {
//   const crdtService = codegen.loadService<Context, CRDTServiceDefinition>(clientPort, CRDTServiceDefinition)

//   async function send(request: CRDTManyMessages) {
//     return crdtService.sendCRDT(request)
//   }

//   async function notificationStream(request: CRDTStreamRequest) {
//     return crdtService.cRDTNotificationStream(request)
//   }

//   return {
//     send,
//     notificationStream
//   }
// }
