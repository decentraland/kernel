import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { CommunicationsControllerServiceDefinition } from '../gen/CommunicationsController'

export async function createCommunicationsControllerServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = await codegen.loadService<Context, CommunicationsControllerServiceDefinition>(
    clientPort,
    CommunicationsControllerServiceDefinition
  )

  return {
    ...originalService,
    async send(message: string): Promise<void> {
      await originalService.send({ message })
    }
  }
}
