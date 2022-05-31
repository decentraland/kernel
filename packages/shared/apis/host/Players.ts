// import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'
// import { ExposableAPI } from './ExposableAPI'
// import { ParcelIdentity } from './ParcelIdentity'

// import { store } from 'shared/store/isolatedStore'

import { AvatarForUserData } from 'shared/types'
// import { getProfileFromStore } from 'shared/profiles/selectors'
// import { calculateDisplayName } from 'shared/profiles/transformations/processServerProfile'

// import { getVisibleAvatarsUserId } from 'shared/sceneEvents/visibleAvatars'
// import { getInSceneAvatarsUserId } from 'shared/social/avatarTracker'
// import { lastPlayerPosition } from 'shared/world/positionThings'
// import { getCurrentUserId } from 'shared/session/selectors'
// import { isWorldPositionInsideParcels } from 'atomicHelpers/parcelScenePositions'
import { AvatarInfo } from '@dcl/schemas'
import { rgbToHex } from 'shared/profiles/transformations/convertToRGBObject'

// export interface IPlayers {
//   /**
//    * Return the players's data
//    */
//   getPlayerData(opt: { userId: string }): Promise<UserData | null>
//   getConnectedPlayers(): Promise<{ userId: string }[]>
//   getPlayersInScene(): Promise<{ userId: string }[]>
// }

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

// @registerAPI('Players')
// export class Players extends ExposableAPI implements IPlayers {
//   @exposeMethod
//   async getPlayerData(opt: { userId: string }): Promise<UserData | null> {
//     const userId = opt.userId
//     const profile = getProfileFromStore(store.getState(), userId)

//     if (!profile?.data) {
//       return null
//     }

//     return {
//       displayName: calculateDisplayName(profile.data),
//       publicKey: profile.data.hasConnectedWeb3 ? profile.data.userId : null,
//       hasConnectedWeb3: !!profile.data.hasConnectedWeb3,
//       userId: userId,
//       version: profile.data.version,
//       avatar: sdkCompatibilityAvatar(profile.data.avatar)
//     }
//   }

//   @exposeMethod
//   async getConnectedPlayers(): Promise<{ userId: string }[]> {
//     return getVisibleAvatarsUserId().map((userId) => {
//       return { userId }
//     })
//   }

//   @exposeMethod
//   async getPlayersInScene(): Promise<{ userId: string }[]> {
//     const parcelIdentity = this.options.getAPIInstance(ParcelIdentity)
//     const currentUserId = getCurrentUserId(store.getState())
//     const sceneParcels = parcelIdentity.land.sceneJsonData.scene.parcels

//     let isCurrentUserIncluded = false

//     const result: { userId: string }[] = []
//     for (const userId of getInSceneAvatarsUserId(parcelIdentity.cid)) {
//       if (userId === currentUserId) {
//         isCurrentUserIncluded = true
//       }
//       result.push({ userId })
//     }

//     // check also for current user, since it won't appear in `getInSceneAvatarsUserId` result
//     if (!isCurrentUserIncluded && isWorldPositionInsideParcels(sceneParcels, lastPlayerPosition)) {
//       if (currentUserId) {
//         result.push({ userId: currentUserId })
//       }
//     }

//     return result
//   }
// }
import { RpcServerPort } from '@dcl/rpc'
import { PortContext } from './context'
import * as codegen from '@dcl/rpc/dist/codegen'

import { PlayersServiceDefinition } from './../gen/Players'

export function registerPlayersServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, PlayersServiceDefinition, async () => ({
    async realGetPlayerData() {
      return {} as any
    },
    async realGetPlayersInScene() {
      return {} as any
    },
    async realGetConnectedPlayers() {
      return {} as any
    }
  }))
}
