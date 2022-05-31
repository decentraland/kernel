import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { UserActionModuleServiceDefinition } from '../gen/UserActionModule'

export async function createUserActionModuleServiceClient<Context>(clientPort: RpcClientPort) {
  const realService = await codegen.loadService<Context, UserActionModuleServiceDefinition>(
    clientPort,
    UserActionModuleServiceDefinition
  )

  return {
    ...realService,
    async requestTeleport(destination: string): Promise<void> {
      await realService.realRequestTeleport({ destination })
    }
  }
}
