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

/*
 * This function is called when the TransportService works.
 * And it should register all the kernel services (Renderer->Kernel)
 */
async function registerKernelServices(serverPort: RpcServerPort<RendererProtocolContext>) {
  registerEmotesKernelService(serverPort)
}
