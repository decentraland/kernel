import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'

import { UserData } from 'shared/types'
import { calculateDisplayName } from 'shared/profiles/transformations/processServerProfile'
import { EnsureProfile } from 'shared/profiles/ProfileAsPromise'

import { ExposableAPI } from './ExposableAPI'
import { onLoginCompleted } from 'shared/session/sagas'
import { store } from 'shared/store/isolatedStore'
import { hasConnectedWeb3 as hasConnectedWeb3Selector } from 'shared/profiles/selectors'

export interface IUserIdentity {
  /**
   * Return the Ethereum address of the user
   */
  getUserPublicKey(): Promise<string | null>

  /**
   * Return the user's data
   */
  getUserData(): Promise<UserData | null>
}

@registerAPI('Identity')
export class UserIdentity extends ExposableAPI implements IUserIdentity {
  @exposeMethod
  async getUserPublicKey(): Promise<string | null> {
    const { identity } = await onLoginCompleted()
    if (!identity || !identity.address) {
      debugger
    }
    return identity && identity.hasConnectedWeb3 ? identity.address : null
  }

  @exposeMethod
  async getUserData(opt?: { userId?: string }): Promise<UserData | null> {
    let profile = null
    let userId = opt?.userId
    let hasConnectedWeb3 = false

    if (!userId) {
      const { identity } = await onLoginCompleted()

      if (!identity || !identity.address) {
        debugger
        return null
      }

      profile = await EnsureProfile(identity?.address)
      userId = profile.userId
      hasConnectedWeb3 = !!identity.hasConnectedWeb3
    } else {
      profile = await EnsureProfile(userId)
      hasConnectedWeb3 = hasConnectedWeb3Selector(store.getState(), userId)
    }

    return {
      displayName: calculateDisplayName(userId, profile),
      publicKey: hasConnectedWeb3 ? profile?.ethAddress : null,
      hasConnectedWeb3: hasConnectedWeb3,
      userId: userId,
      version: profile.version,
      avatar: { ...profile.avatar }
    }
  }
}
