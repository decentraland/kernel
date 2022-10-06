import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { UserActionModuleServiceDefinition } from 'shared/protocol/kernel/apis/UserActionModule.gen'

export namespace UserActionModuleServiceClient {
  export function create<Context>(clientPort: RpcClientPort) {
    return codegen.loadService<Context, UserActionModuleServiceDefinition>(
      clientPort,
      UserActionModuleServiceDefinition
    )
  }
  export function createLegacy<Context>(clientPort: RpcClientPort) {
    const originalService = codegen.loadService<Context, UserActionModuleServiceDefinition>(
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
}
