import { createRpcClient, Transport } from '@dcl/rpc'
import future, { IFuture } from 'fp-future'
import { registerCRDTService } from './services/crdtService'
import { RendererProtocol } from './types'

export const rendererProtocol: IFuture<RendererProtocol> = future()

export async function createRendererRpcClient(transport: Transport): Promise<RendererProtocol> {
  const rpcClient = await createRpcClient(transport)
  const clientPort = await rpcClient.createPort('renderer-protocol')

  const crdtService = registerCRDTService(clientPort)

  rendererProtocol.resolve({
    crdtService
  })

  return rendererProtocol
}
