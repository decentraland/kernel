// import * as codegen from '@dcl/rpc/dist/codegen'
// import { createRpcClient, RpcClientPort, Transport } from '@dcl/rpc'
// import { CRDTServiceDefinition } from './proto/CRDT.gen'
import { createRpcClient, Transport } from '@dcl/rpc'

// const createCRDTServiceClient = <Context>(clientPort: RpcClientPort) =>
//   codegen.loadService<Context, CRDTServiceDefinition>(clientPort, CRDTServiceDefinition)

/*
const ws = new WebSocket('wss://server:1234') // TODO: use real ws
const rpcClient = await createRpcClient(WebSocketTransport(ws))
const clientPort = await rpcClient.createPort('renderer-protocol')

const crdtService = createCRDTServiceClient(clientPort)
*/
// export async function initializeRendererRpcClient(options: CommonRendererOptions, wsUrl?: string) {
//   let transport: Transport
//   if (wsUrl) {
//     const ws = new WebSocket(wsUrl) // TODO: use real ws
//     transport = await webSocketTransportAdapter(ws)
//   } else {
//     // native transport
//     const ws = new WebSocket('dummy')
//     transport = WebSocketTransport(ws)
//   }

//   const rpcClient = await createRpcClient(transport)
//   const clientPort = await rpcClient.createPort('renderer-protocol')

//   const crdtService = createCRDTServiceClient(clientPort)
// }

export async function createRendererRpcClient(transport: Transport) {
  const rpcClient = await createRpcClient(transport)
  const clientPort = await rpcClient.createPort('renderer-protocol')
  //const crdtService = createCRDTServiceClient(clientPort)
  return clientPort
}
