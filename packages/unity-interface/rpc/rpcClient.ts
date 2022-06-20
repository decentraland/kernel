// import * as codegen from '@dcl/rpc/dist/codegen'
// import { createRpcClient, RpcClientPort, Transport } from '@dcl/rpc'
// import { CRDTServiceDefinition } from './proto/CRDT.gen'
import { createRpcClient, Transport } from '@dcl/rpc'
import * as codegen from '@dcl/rpc/dist/codegen'
import { Context } from 'mocha'
import { PingPongServiceDefinition } from './proto/RendererProtocol.gen'

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
  console.log("[RPC] createRpcClient")
  const rpcClient = await createRpcClient(transport)
  console.log("[RPC] createPort")
  const clientPort = await rpcClient.createPort('renderer-protocol')

  console.log("[RPC] loadService")
  const pingPongService = codegen.loadService<Context, PingPongServiceDefinition>(clientPort, PingPongServiceDefinition)
  console.log("[RPC] ping")
  const ping = () => {
    setTimeout(async () => {
      console.log('[RPC] Send ping...')
      await pingPongService.ping({})
      console.log('[RPC] Pong!')
      ping()
    }, 1000);
  }
  ping()

  //const crdtService = createCRDTServiceClient(clientPort)
  return clientPort
}
