import { createRpcClient, Transport } from '@dcl/rpc'
import { registerCRDTService } from './services/crdtService'
import { registerPingService } from './services/pingService'
import { RendererProtocol } from './types'

export async function createRendererRpcClient(transport: Transport): Promise<RendererProtocol> {
  const rpcClient = await createRpcClient(transport)
  const clientPort = await rpcClient.createPort('renderer-protocol')

  const crdtService = registerCRDTService(clientPort)
  const pingService = registerPingService(clientPort)

  return {
    crdtService,
    pingService
  }
}
