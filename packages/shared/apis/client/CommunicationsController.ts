import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { CommunicationsControllerServiceDefinition } from 'shared/protocol/kernel/apis/CommunicationsController.gen'

export namespace CommunicationsControllerServiceClient {
  export function create<Context>(clientPort: RpcClientPort) {
    return codegen.loadService<Context, CommunicationsControllerServiceDefinition>(
      clientPort,
      CommunicationsControllerServiceDefinition
    )
  }

  export function createLegacy<Context>(clientPort: RpcClientPort) {
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
}
