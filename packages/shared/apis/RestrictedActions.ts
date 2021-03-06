import { exposeMethod, registerAPI } from 'decentraland-rpc/lib/host'
import { ExposableAPI } from './ExposableAPI'
import defaultLogger from '../logger'
import { ParcelIdentity } from './ParcelIdentity'
import { Quaternion, Vector3 } from 'decentraland-ecs'
import {
  gridToWorld,
  isWorldPositionInsideParcels,
  parseParcelPosition
} from '../../atomicHelpers/parcelScenePositions'
import { lastPlayerPosition } from '../world/positionThings'
import { browserInterface } from '../../unity-interface/BrowserInterface'
import { getUnityInstance } from 'unity-interface/IUnityInterface'

export enum Permission {
  ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE = 'ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE',
  ALLOW_TO_TRIGGER_AVATAR_EMOTE = 'ALLOW_TO_TRIGGER_AVATAR_EMOTE'
}

@registerAPI('RestrictedActions')
export class RestrictedActions extends ExposableAPI {
  parcelIdentity = this.options.getAPIInstance(ParcelIdentity)

  @exposeMethod
  async movePlayerTo(newPosition: Vector3, cameraTarget?: Vector3): Promise<void> {
    // checks permissions
    if (!this.hasPermission(Permission.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE)) {
      defaultLogger.error(`Permission "${Permission.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE}" is required`)
      return
    }

    const base = parseParcelPosition(this.parcelIdentity.isPortableExperience ? '0,0' : this.getSceneData().scene.base)
    const basePosition = new Vector3()
    gridToWorld(base.x, base.y, basePosition)

    const position = basePosition.add(newPosition)

    // validate new position is inside one of the scene's parcels
    if (!this.isPositionValid(position)) {
      defaultLogger.error('Error: Position is out of scene', position)
      return
    }
    if (!this.isPositionValid(lastPlayerPosition)) {
      defaultLogger.error('Error: Player is not inside of scene', lastPlayerPosition)
      return
    }

    getUnityInstance().Teleport(
      {
        position,
        cameraTarget: cameraTarget ? basePosition.add(cameraTarget) : undefined
      },
      false
    )

    // Get ahead of the position report that will be done automatically later and report
    // position right now, also marked as an immediate update (last bool in Position structure)
    browserInterface.ReportPosition({
      position: newPosition,
      rotation: Quaternion.Identity,
      immediate: true
    })
  }

  @exposeMethod
  async triggerEmote(emote: Emote): Promise<void> {
    // checks permissions
    if (!this.hasPermission(Permission.ALLOW_TO_TRIGGER_AVATAR_EMOTE)) {
      defaultLogger.error(`Permission "${Permission.ALLOW_TO_TRIGGER_AVATAR_EMOTE}" is required`)
      return
    }

    if (!this.isPositionValid(lastPlayerPosition)) {
      defaultLogger.error('Error: Player is not inside of scene', lastPlayerPosition)
      return
    }

    getUnityInstance().TriggerSelfUserExpression(emote.predefined)
  }

  private getSceneData() {
    return this.parcelIdentity.land.sceneJsonData
  }

  private hasPermission(permission: Permission) {
    if (this.parcelIdentity.isPortableExperience) {
      return true
    }

    const json = this.getSceneData()
    const list = json.requiredPermissions || []
    return list.indexOf(permission) !== -1
  }

  private isPositionValid(position: Vector3) {
    return (
      this.parcelIdentity.isPortableExperience ||
      isWorldPositionInsideParcels(this.getSceneData().scene.parcels, position)
    )
  }
}

type Emote = {
  predefined: PredefinedEmote
}

type PredefinedEmote = string

/**
 * We are leaving this RestrictedActionModule version here for backwards compatibility purposes.
 * RestrictedActions was previously called RestrictedActionModule, so we need to continue exposing this API for already deployed scenes.
 */
@registerAPI('RestrictedActionModule')
export class RestrictedActionModule extends ExposableAPI {
  @exposeMethod
  movePlayerTo(newPosition: Vector3, cameraTarget?: Vector3): Promise<void> {
    return this.options.getAPIInstance(RestrictedActions).movePlayerTo(newPosition, cameraTarget)
  }
}
