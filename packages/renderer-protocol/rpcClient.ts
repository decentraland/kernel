import { createRpcClient, Transport } from '@dcl/rpc'
import future, { IFuture } from 'fp-future'
import { registerCRDTService } from './services/crdtService'
import { registerTeleportService } from './services/teleportService'
import { RendererProtocol } from './types'
import { startRendererServices } from 'unity-interface/services/rendererStarter'

export const rendererProtocol: IFuture<RendererProtocol> = future()

export async function createRendererRpcClient(transport: Transport): Promise<RendererProtocol> {
  const rpcClient = await createRpcClient(transport)
  const clientPort = await rpcClient.createPort('renderer-protocol')

  rendererProtocol.resolve({
    crdtService: registerCRDTService(clientPort),
    teleportService: registerTeleportService(clientPort)
  })

  startRendererServices()

  return rendererProtocol
}
