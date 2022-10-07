import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { Snapshots } from '@dcl/schemas'
import { UserIdentityServiceDefinition } from '../../../shared/protocol/kernel/apis/UserIdentity.gen'

/** THIS TYPE IS APPEND ONLY BECAUSE IT IS USED FOR THE SDK APIs */
export type UserData = {
  displayName: string
  publicKey: string | null
  hasConnectedWeb3: boolean
  userId: string
  version: number
  avatar: AvatarForUserData
}

export type AvatarForUserData = {
  bodyShape: string
  skinColor: string
  hairColor: string
  eyeColor: string
  wearables: string[]
  emotes?: {
    slot: number
    urn: string
  }[]
  snapshots: Snapshots
}

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
