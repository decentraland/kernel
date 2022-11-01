import { createRpcClient, Transport } from '@dcl/rpc'
import future, { IFuture } from 'fp-future'
import { registerCRDTService } from './services/crdtService'
import { registerEmotesService } from './services/emotesService'
import { registerRpcTransportService } from './services/transportService'
import { RendererProtocol } from './types'

export const rendererProtocol: IFuture<RendererProtocol> = future()

export async function createRendererRpcClient(transport: Transport): Promise<RendererProtocol> {
  const rpcClient = await createRpcClient(transport)
  const clientPort = await rpcClient.createPort('renderer-protocol')

  registerRpcTransportService(clientPort)

  const crdtService = registerCRDTService(clientPort)
  const emotesService = registerEmotesService(clientPort)

  rendererProtocol.resolve({
    crdtService,
    emotesService
  })

  return rendererProtocol
}
