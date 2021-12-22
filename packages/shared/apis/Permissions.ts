import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'
import { ExposableAPI } from './ExposableAPI'
import { ParcelIdentity } from './ParcelIdentity'

export enum PermissionItem {
  ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE = 'ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE',
  ALLOW_TO_TRIGGER_AVATAR_EMOTE = 'ALLOW_TO_TRIGGER_AVATAR_EMOTE',
  USE_WEB3_API = 'USE_WEB3_API',
  USE_WEBSOCKET = 'USE_WEBSOCKET',
  USE_FETCH = 'USE_FETCH'
}

export const defaultParcelPermissions = [PermissionItem.USE_WEB3_API]
export const defaultPortableExperiencePermissions = []

@registerAPI('Permissions')
export class Permissions extends ExposableAPI {
  parcelIdentity = this.options.getAPIInstance(ParcelIdentity)
  protected permissionGranted: PermissionItem[] = defaultParcelPermissions

  /**
   * Returns if it has a specific permission
   */
  @exposeMethod
  async hasPermission(test: PermissionItem): Promise<boolean> {
    // Backward compatibility with parcel scene with 'requiredPermissions' in the scene.json
    //  Only the two permissions that start with ALLOW_TO_... can be conceed without user
    //  interaction
    if (this.parcelIdentity.land) {
      const json = this.parcelIdentity.land.sceneJsonData
      const list = (json?.requiredPermissions || []) as PermissionItem[]

      if (
        list.includes(test) &&
        (test === PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE ||
          test === PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE)
      ) {
        return true
      }
    }

    return this.permissionGranted.includes(test)
  }
  /**
   * Returns if it has many permissions
   */
  @exposeMethod
  async hasManyPermissions(test: PermissionItem[]): Promise<boolean> {
    for (const item of test) {
      if (!(await this.hasPermission(item))) {
        return false
      }
    }
    return true
  }

  /**
   * Reset all permissions granted
   */
  resetPermissions() {
    this.permissionGranted = []
  }
}
