import { Vector3, Quaternion } from '@dcl/ecs-math'
import defaultLogger from '../../logger'
import {
  gridToWorld,
  isWorldPositionInsideParcels,
  parseParcelPosition
} from '../../../atomicHelpers/parcelScenePositions'
import { lastPlayerPosition } from '../../world/positionThings'
import { browserInterface } from '../../../unity-interface/BrowserInterface'
import { getUnityInstance } from '../../../unity-interface/IUnityInterface'
// import { PermissionItem } from './../gen/Permissions'
import { RpcServerPort } from '@dcl/rpc'
import { PortContext } from './context'
import * as codegen from '@dcl/rpc/dist/codegen'

import { RestrictedActionsServiceDefinition } from './../gen/RestrictedActions'

export function registerRestrictedActionsServiceServerImplementation(port: RpcServerPort<PortContext>) {
  function isPositionValid(position: Vector3, ctx: PortContext) {
    return (
      ctx.ParcelIdentity!.isPortableExperience ||
      isWorldPositionInsideParcels(ctx.ParcelIdentity!.land.sceneJsonData.scene.parcels, position)
    )
  }
  codegen.registerService(port, RestrictedActionsServiceDefinition, async () => ({
    async realMovePlayerTo(req, ctx) {
      //   checks permissions
      // await this.assertHasPermissions([PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE])
      if (!ctx.ParcelIdentity) return {}

      const base = parseParcelPosition(
        ctx.ParcelIdentity.isPortableExperience ? '0,0' : ctx.ParcelIdentity.land.sceneJsonData.scene.base
      )
      const basePosition = new Vector3()
      gridToWorld(base.x, base.y, basePosition)

      // newRelativePosition is the position relative to the scene in meters
      // newAbsolutePosition is the absolute position in the world in meters
      const newAbsolutePosition = basePosition.add(req.newRelativePosition!)

      // validate new position is inside one of the scene's parcels
      if (!isPositionValid(newAbsolutePosition, ctx)) {
        defaultLogger.error('Error: Position is out of scene', newAbsolutePosition)
        return
      }
      if (!isPositionValid(lastPlayerPosition, ctx)) {
        defaultLogger.error('Error: Player is not inside of scene', lastPlayerPosition)
        return
      }

      getUnityInstance().Teleport(
        {
          position: newAbsolutePosition,
          cameraTarget: req.cameraTarget ? basePosition.add(req.cameraTarget) : undefined
        },
        false
      )

      // Get ahead of the position report that will be done automatically later and report
      // position right now, also marked as an immediate update (last bool in Position structure)
      browserInterface.ReportPosition({
        position: newAbsolutePosition,
        rotation: Quaternion.Identity,
        immediate: true
      })
      return {} as any
    },
    async realTriggerEmote(req, ctx) {
      // checks permissions
      // await this.assertHasPermissions([PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE])

      if (!isPositionValid(lastPlayerPosition, ctx)) {
        defaultLogger.error('Error: Player is not inside of scene', lastPlayerPosition)
        return
      }

      getUnityInstance().TriggerSelfUserExpression(req.predefinedEmote)
      return {} as any
    }
  }))
}

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
