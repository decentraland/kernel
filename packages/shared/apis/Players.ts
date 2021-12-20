import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'
import { ExposableAPI } from './ExposableAPI'
import { ParcelIdentity } from './ParcelIdentity'

import { store } from 'shared/store/isolatedStore'

import { UserData } from 'shared/types'
import { hasConnectedWeb3 as hasConnectedWeb3Selector } from 'shared/profiles/selectors'
import { getProfileIfExist } from 'shared/profiles/ProfileAsPromise'
import { calculateDisplayName } from 'shared/profiles/transformations/processServerProfile'

import { getVisibleAvatarsUserId } from 'shared/sceneEvents/visibleAvatars'
import { getInSceneAvatarsUserId } from 'shared/social/avatarTracker'
import { lastPlayerPosition } from 'shared/world/positionThings'
import { getCurrentUserId } from 'shared/session/selectors'
import { isWorldPositionInsideParcels } from 'atomicHelpers/parcelScenePositions'

export interface IPlayers {
  /**
   * Return the players's data
   */
  getPlayerData(opt: { userId: string }): Promise<UserData | null>
  getConnectedPlayers(): Promise<{ userId: string }[]>
  getPlayersInScene(): Promise<{ userId: string }[]>
}

@registerAPI('Players')
export class Players extends ExposableAPI implements IPlayers {
  @exposeMethod
  async getPlayerData(opt: { userId: string }): Promise<UserData | null> {
    const userId = opt.userId
    const profile = getProfileIfExist(userId)

    if (!profile) {
      return null
    }

    const hasConnectedWeb3 = hasConnectedWeb3Selector(store.getState(), userId)

    return {
      displayName: calculateDisplayName(userId, profile),
      publicKey: hasConnectedWeb3 ? profile.ethAddress : null,
      hasConnectedWeb3: hasConnectedWeb3,
      userId: userId,
      version: profile.version,
      avatar: { ...profile.avatar }
    }
  }

  @exposeMethod
  async getConnectedPlayers(): Promise<{ userId: string }[]> {
    return getVisibleAvatarsUserId().map((userId) => {
      return { userId }
    })
  }

  @exposeMethod
  async getPlayersInScene(): Promise<{ userId: string }[]> {
    const parcelIdentity = this.options.getAPIInstance(ParcelIdentity)
    const currentUserId = getCurrentUserId(store.getState())
    const sceneParcels = parcelIdentity.land.sceneJsonData.scene.parcels

    let isCurrentUserIncluded = false

    const result = []
    for (const userId of getInSceneAvatarsUserId(parcelIdentity.cid)) {
      if (userId === currentUserId) {
        isCurrentUserIncluded = true
      }
      result.push({ userId })
    }

    // check also for current user, since it won't appear in `getInSceneAvatarsUserId` result
    if (!isCurrentUserIncluded && isWorldPositionInsideParcels(sceneParcels, lastPlayerPosition)) {
      if (currentUserId) {
        result.push({ userId: currentUserId })
      }
    }

    return result
  }
}
