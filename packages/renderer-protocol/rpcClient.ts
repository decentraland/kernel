import { createRpcClient, Transport } from '@dcl/rpc'
import future, { IFuture } from 'fp-future'
import { registerCRDTService } from './services/crdtService'
import { registerPingService } from './services/pingService'
import { RendererProtocol } from './types'

export const rendererProtocol: IFuture<RendererProtocol> = future()

export async function createRendererRpcClient(transport: Transport): Promise<RendererProtocol> {
  const rpcClient = await createRpcClient(transport)
  const clientPort = await rpcClient.createPort('renderer-protocol')

  const crdtService = registerCRDTService(clientPort)
  const pingService = registerPingService(clientPort)

  rendererProtocol.resolve({
    crdtService,
    pingService
  })

  return rendererProtocol
}
