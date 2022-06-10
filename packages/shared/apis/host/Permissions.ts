import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import {
  PermissionsServiceDefinition,
  PermissionItem,
  permissionItemFromJSON,
  permissionItemToJSON
} from '../proto/Permissions.gen'
import { PortContext } from './context'

export const defaultParcelPermissions: PermissionItem[] = [
  PermissionItem.USE_WEB3_API,
  PermissionItem.USE_FETCH,
  PermissionItem.USE_WEBSOCKET
]
export const defaultPortableExperiencePermissions: PermissionItem[] = []

export function assertHasPermission(test: PermissionItem, ctx: PortContext) {
  if (!hasPermission(test, ctx)) {
    throw new Error(`This scene doesn't have some of the next permissions: ${permissionItemToJSON(test)}.`)
  }

  return true
}

export function hasPermission(test: PermissionItem, ctx: PortContext) {
  // Backward compatibility with parcel scene with 'requiredPermissions' in the scene.json
  //  Only the two permissions that start with ALLOW_TO_... can be conceed without user
  //  interaction

  if (ctx.ParcelIdentity) {
    const sceneJsonData = ctx.ParcelIdentity.land?.sceneJsonData
    const list: PermissionItem[] = []

    if (sceneJsonData && sceneJsonData.requiredPermissions) {
      for (const permissionItemString of sceneJsonData.requiredPermissions) {
        const permissionItem = permissionItemFromJSON(permissionItemString)
        if (permissionItem !== PermissionItem.UNRECOGNIZED) {
          list.push(permissionItem)
        }
      }
    }

    if (
      list.includes(test) &&
      (test === PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE ||
        test === PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE)
    ) {
      return true
    }

    // Workaround to give old default permissions, remove when
    //  a method for grant permissions exist.
    if (ctx.ParcelIdentity.isPortableExperience) {
      if (
        test === PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE ||
        test === PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE
      ) {
        return true
      }
    }
  }

  return ctx.Permissions.permissionGranted.includes(test)
}

export function registerPermissionServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, PermissionsServiceDefinition, async () => ({
    async hasPermission(req, ctx) {
      return { hasPermission: hasPermission(req.permission, ctx) }
    },
    async hasManyPermissions(req, ctx) {
      const hasManyPermission = await Promise.all(req.permissions.map((item) => hasPermission(item, ctx)))
      return { hasManyPermission }
    }
  }))
}
