import { UserData } from 'shared/types'
import { calculateDisplayName } from 'shared/profiles/transformations/processServerProfile'
import { ProfileAsPromise } from 'shared/profiles/ProfileAsPromise'

import { onLoginCompleted } from 'shared/session/sagas'
import { sdkCompatibilityAvatar } from './Players'

import { UserIdentityServiceDefinition } from './gen/UserIdentity'
import { PortContext } from './context'
import { RpcClientPort, RpcServerPort } from '@dcl/rpc'
import * as codegen from '@dcl/rpc/dist/codegen'

// export interface IUserIdentity {
//   /**
//    * Return the Ethereum address of the user
//    */
//   getUserPublicKey(): Promise<string | null>

//   /**
//    * Return the user's data
//    */
//   getUserData(): Promise<UserData | null>
// }

export function registerUserIdentityServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, UserIdentityServiceDefinition, async () => ({
    async realGetUserPublicKey() {
      const { identity } = await onLoginCompleted()
      if (!identity || !identity.address) {
        debugger
      }
      if (identity && identity.hasConnectedWeb3) {
        return { address: identity.address }
      } else {
        return {}
      }
    },
    async realGetUserData() {
      const { identity } = await onLoginCompleted()

      if (!identity || !identity.address) {
        debugger
        return {}
      }

      const profile = await ProfileAsPromise(identity?.address)

      return {
        data: {
          displayName: calculateDisplayName(profile),
          publicKey: identity.hasConnectedWeb3 ? identity.address : undefined,
          hasConnectedWeb3: !!identity.hasConnectedWeb3,
          userId: identity.address,
          version: profile.version,
          avatar: sdkCompatibilityAvatar(profile.avatar)
        }
      }
    }
  }))
}

export const createUserIdentityServiceClient = <Context>(clientPort: RpcClientPort) => {
  const realService = codegen.loadService<Context, UserIdentityServiceDefinition>(
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
