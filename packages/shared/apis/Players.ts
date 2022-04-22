import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'
import { ExposableAPI } from './ExposableAPI'
import { ParcelIdentity } from './ParcelIdentity'

import { store } from 'shared/store/isolatedStore'

import { AvatarForUserData, UserData } from 'shared/types'
import { getHasConnectedWeb3 } from 'shared/profiles/selectors'
import { getProfileIfExist } from 'shared/profiles/ProfileAsPromise'
import { calculateDisplayName } from 'shared/profiles/transformations/processServerProfile'

import { getVisibleAvatarsUserId } from 'shared/sceneEvents/visibleAvatars'
import { getInSceneAvatarsUserId } from 'shared/social/avatarTracker'
import { lastPlayerPosition } from 'shared/world/positionThings'
import { getCurrentUserId } from 'shared/session/selectors'
import { isWorldPositionInsideParcels } from 'atomicHelpers/parcelScenePositions'
import { AvatarInfo } from '@dcl/schemas'
import { rgbToHex } from 'shared/profiles/transformations/convertToRGBObject'

export interface IPlayers {
  /**
   * Return the players's data
   */
  getPlayerData(opt: { userId: string }): Promise<UserData | null>
  getConnectedPlayers(): Promise<{ userId: string }[]>
  getPlayersInScene(): Promise<{ userId: string }[]>
}

export function sdkCompatibilityAvatar(avatar: AvatarInfo): AvatarForUserData {
  return {
    ...avatar,
    bodyShape: avatar.bodyShape,
    wearables: avatar.wearables,
    snapshots: {
      ...avatar.snapshots,
      face: avatar.snapshots.face256,
      face128: avatar.snapshots.face256
    } as any,
    eyeColor: rgbToHex(avatar.eyes.color),
    hairColor: rgbToHex(avatar.hair.color),
    skinColor: rgbToHex(avatar.hair.color)
  }
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

    const hasConnectedWeb3 = getHasConnectedWeb3(store.getState(), userId)

    return {
      displayName: calculateDisplayName(userId, profile),
      publicKey: hasConnectedWeb3 ? profile.ethAddress : null,
      hasConnectedWeb3: hasConnectedWeb3,
      userId: userId,
      version: profile.version,
      avatar: sdkCompatibilityAvatar(profile.avatar)
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

    const result: { userId: string }[] = []
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
