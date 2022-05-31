import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { UserIdentityServiceDefinition } from '../gen/UserIdentity'
import { UserData } from '../../types'

export async function createUserIdentityServiceClient<Context>(clientPort: RpcClientPort) {
  const realService = await codegen.loadService<Context, UserIdentityServiceDefinition>(
    clientPort,
    UserIdentityServiceDefinition
  )

  return {
    ...realService,
    async getUserPublicKey(): Promise<string | null> {
      const realResponse = await realService.realGetUserPublicKey({})
      return realResponse.address || null
    },
    async getUserData(): Promise<UserData | null> {
      const realResponse = await realService.realGetUserData({})
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
