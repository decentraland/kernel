import * as codegen from '@dcl/rpc/dist/codegen'
import type { RpcClientPort } from '@dcl/rpc/dist/types'
import { CommunicationsControllerServiceDefinition } from '../proto/CommunicationsController.gen'

export function createCommunicationsControllerServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = codegen.loadService<Context, CommunicationsControllerServiceDefinition>(
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
