// import { Vector3, Quaternion } from '@dcl/ecs-math'
// import { exposeMethod, registerAPI } from 'decentraland-rpc/lib/host'
// import { RestrictedExposableAPI } from './RestrictedExposableAPI'
// import defaultLogger from '../logger'
// import { ParcelIdentity } from './ParcelIdentity'
// import {
//   gridToWorld,
//   isWorldPositionInsideParcels,
//   parseParcelPosition
// } from '../../atomicHelpers/parcelScenePositions'
// import { lastPlayerPosition } from '../world/positionThings'
// import { browserInterface } from '../../unity-interface/BrowserInterface'
// import { getUnityInstance } from 'unity-interface/IUnityInterface'
// import { PermissionItem } from './PermissionItems'

// @registerAPI('RestrictedActions')
// export class RestrictedActions extends RestrictedExposableAPI {
//   parcelIdentity = this.options.getAPIInstance(ParcelIdentity)

//   @exposeMethod
//   async movePlayerTo(newRelativePosition: Vector3, cameraTarget?: Vector3): Promise<void> {
//     // checks permissions
//     await this.assertHasPermissions([PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE])

//     const base = parseParcelPosition(this.parcelIdentity.isPortableExperience ? '0,0' : this.getSceneData().scene.base)
//     const basePosition = new Vector3()
//     gridToWorld(base.x, base.y, basePosition)

//     // newRelativePosition is the position relative to the scene in meters
//     // newAbsolutePosition is the absolute position in the world in meters
//     const newAbsolutePosition = basePosition.add(newRelativePosition)

//     // validate new position is inside one of the scene's parcels
//     if (!this.isPositionValid(newAbsolutePosition)) {
//       defaultLogger.error('Error: Position is out of scene', newAbsolutePosition)
//       return
//     }
//     if (!this.isPositionValid(lastPlayerPosition)) {
//       defaultLogger.error('Error: Player is not inside of scene', lastPlayerPosition)
//       return
//     }

//     getUnityInstance().Teleport(
//       {
//         position: newAbsolutePosition,
//         cameraTarget: cameraTarget ? basePosition.add(cameraTarget) : undefined
//       },
//       false
//     )

//     // Get ahead of the position report that will be done automatically later and report
//     // position right now, also marked as an immediate update (last bool in Position structure)
//     browserInterface.ReportPosition({
//       position: newAbsolutePosition,
//       rotation: Quaternion.Identity,
//       immediate: true
//     })
//   }

//   @exposeMethod
//   async triggerEmote(emote: Emote): Promise<void> {
//     // checks permissions
//     await this.assertHasPermissions([PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE])

//     if (!this.isPositionValid(lastPlayerPosition)) {
//       defaultLogger.error('Error: Player is not inside of scene', lastPlayerPosition)
//       return
//     }

//     getUnityInstance().TriggerSelfUserExpression(emote.predefined)
//   }

//   private getSceneData() {
//     return this.parcelIdentity.land.sceneJsonData
//   }

//   private isPositionValid(position: Vector3) {
//     return (
//       this.parcelIdentity.isPortableExperience ||
//       isWorldPositionInsideParcels(this.getSceneData().scene.parcels, position)
//     )
//   }
// }

// type Emote = {
//   predefined: PredefinedEmote
// }

// type PredefinedEmote = string

// /**
//  * We are leaving this RestrictedActionModule version here for backwards compatibility purposes.
//  * RestrictedActions was previously called RestrictedActionModule, so we need to continue exposing this API for already deployed scenes.
//  */
// @registerAPI('RestrictedActionModule')
// export class RestrictedActionModule extends RestrictedExposableAPI {
//   @exposeMethod
//   movePlayerTo(newPosition: Vector3, cameraTarget?: Vector3): Promise<void> {
//     return this.options.getAPIInstance(RestrictedActions).movePlayerTo(newPosition, cameraTarget)
//   }
// }
