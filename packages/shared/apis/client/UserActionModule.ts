import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { UserActionModuleServiceDefinition } from '../proto/UserActionModule'

export async function createUserActionModuleServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = await codegen.loadService<Context, UserActionModuleServiceDefinition>(
    clientPort,
    UserActionModuleServiceDefinition
  )

  return {
    ...originalService,
    async requestTeleport(destination: string): Promise<void> {
      await originalService.requestTeleport({ destination })
    }
  }
}
