import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { CommunicationsControllerServiceDefinition } from '../gen/CommunicationsController'

export async function createCommunicationsControllerServiceClient<Context>(clientPort: RpcClientPort) {
  const realService = await codegen.loadService<Context, CommunicationsControllerServiceDefinition>(
    clientPort,
    CommunicationsControllerServiceDefinition
  )

  await realService.init({})

  return {
    ...realService,
    async send(message: string): Promise<void> {
      await realService.realSend({ message })
    }
  }
}
