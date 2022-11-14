import { createRpcClient, Transport } from '@dcl/rpc'
import future, { IFuture } from 'fp-future'
import { registerCRDTService } from './services/crdtService'
import { RendererProtocol } from './types'

export const rendererProtocol: IFuture<RendererProtocol> = future()

export async function createRendererRpcClient(transport: Transport): Promise<RendererProtocol> {
  // first wait for transport to be connected
  await new Promise<void>(resolve => transport.on('connect', resolve as any))

  // then load the rpc
  const rpcClient = await createRpcClient(transport)
  const clientPort = await rpcClient.createPort('renderer-protocol')

  const crdtService = registerCRDTService(clientPort)

  rendererProtocol.resolve({
    crdtService
  })

  return rendererProtocol
}
