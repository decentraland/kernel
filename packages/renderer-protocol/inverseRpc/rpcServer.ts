import { createRpcServer, RpcServerPort, Transport } from '@dcl/rpc'
import { RendererProtocolContext } from './context'
import { registerEmotesKernelService } from './services/emotesService'

export function createRendererProtocolInverseRpcServer(transport: Transport) {
  const server = createRpcServer<RendererProtocolContext>({})

  const context: RendererProtocolContext = {
    times: 0
  }

  server.setHandler(registerKernelServices)
  server.attachTransport(transport, context)
}

async function registerKernelServices(serverPort: RpcServerPort<RendererProtocolContext>) {
  registerEmotesKernelService(serverPort)
}
