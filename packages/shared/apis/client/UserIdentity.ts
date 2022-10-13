import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { UserIdentityServiceDefinition } from 'shared/protocol/kernel/apis/UserIdentity.gen'
import { UserData } from '../../types'

export namespace UserIdentityServiceClient {
  export function create<Context>(clientPort: RpcClientPort) {
    return codegen.loadService<Context, UserIdentityServiceDefinition>(clientPort, UserIdentityServiceDefinition)
  }

  export function createLegacy<Context>(clientPort: RpcClientPort) {
    const originalService = codegen.loadService<Context, UserIdentityServiceDefinition>(
      clientPort,
      UserIdentityServiceDefinition
    )

    return {
      ...originalService,
      async getUserPublicKey(): Promise<string | null> {
        const realResponse = await originalService.getUserPublicKey({})
        return realResponse.address || null
      },
      async getUserData(): Promise<UserData | null> {
        const realResponse = await originalService.getUserData({})
        if (!realResponse.data) {
          return null
        }
        return {
          ...realResponse.data,
          avatar: {
            ...realResponse.data.avatar!,
            snapshots: realResponse.data.avatar!.snapshots!
          },
          publicKey: realResponse.data.publicKey || null
        }
      }
    }
  }
}
