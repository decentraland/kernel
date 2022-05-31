// import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'
// import { ExposableAPI } from './ExposableAPI'
// import { ParcelIdentity } from './ParcelIdentity'
// import { PermissionItem } from './PermissionItems'

// export const defaultParcelPermissions = [
//   PermissionItem.USE_WEB3_API,
//   PermissionItem.USE_FETCH,
//   PermissionItem.USE_WEBSOCKET
// ]
// export const defaultPortableExperiencePermissions = []

// @registerAPI('Permissions')
// export class Permissions extends ExposableAPI {
//   parcelIdentity = this.options.getAPIInstance(ParcelIdentity)
//   protected permissionGranted: PermissionItem[] = defaultParcelPermissions

//   /**
//    * Returns if it has a specific permission
//    */
//   @exposeMethod
//   async hasPermission(test: PermissionItem): Promise<boolean> {
//     // Backward compatibility with parcel scene with 'requiredPermissions' in the scene.json
//     //  Only the two permissions that start with ALLOW_TO_... can be conceed without user
//     //  interaction
//     if (this.parcelIdentity.land) {
//       const json = this.parcelIdentity.land.sceneJsonData
//       const list = (json?.requiredPermissions || []) as PermissionItem[]

//       if (
//         list.includes(test) &&
//         (test === PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE ||
//           test === PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE)
//       ) {
//         return true
//       }
//     }

//     // Workaround to give old default permissions, remove when
//     //  a method for grant permissions exist.
//     if (this.parcelIdentity.isPortableExperience) {
//       if (
//         test === PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE ||
//         test === PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE
//       ) {
//         return true
//       }
//     }

//     return this.permissionGranted.includes(test)
//   }
//   /**
//    * Returns if it has many permissions
//    */
//   @exposeMethod
//   async hasManyPermissions(test: PermissionItem[]): Promise<boolean> {
//     for (const item of test) {
//       if (!(await this.hasPermission(item))) {
//         return false
//       }
//     }
//     return true
//   }

//   /**
//    * Reset all permissions granted
//    */
//   resetPermissions() {
//     this.permissionGranted = []
//   }

//   /**
//    * Force permissions
//    */
//   forcePermissions(permissions: PermissionItem[]) {
//     this.permissionGranted = permissions
//   }
// }
import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { PermissionsServiceDefinition, PermissionItem } from '../gen/Permissions'
import { PortContext } from './context'

export function registerPermissionServiceServerImplementation(port: RpcServerPort<PortContext>) {
  function hasPermission(test: PermissionItem, ctx: PortContext) {
    // // Backward compatibility with parcel scene with 'requiredPermissions' in the scene.json
    // //  Only the two permissions that start with ALLOW_TO_... can be conceed without user
    // //  interaction
    // // todo: see the access to land data
    // if (ctx.EngineAPI.parcelSceneAPI.data.data.land) {
    //   const json = ctx.EngineAPI.parcelSceneAPI.data.data.land
    //   const list = (json?.requiredPermissions || []) as PermissionItem[]

    //   if (
    //     list.includes(test) &&
    //     (test === PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE ||
    //       test === PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE)
    //   ) {
    //     return true
    //   }
    // }

    // // Workaround to give old default permissions, remove when
    // //  a method for grant permissions exist.
    // if (ctx.EngineAPI.parcelSceneAPI) {
    //   if (
    //     test === PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE ||
    //     test === PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE
    //   ) {
    //     return true
    //   }
    // }

    // return ctx.Permissions.permissionGranted.includes(test)
    return true
  }
  codegen.registerService(port, PermissionsServiceDefinition, async () => ({
    async realHasPermission(req, ctx) {
      return { hasPermission: hasPermission(req.permission, ctx) }
    },
    async realHasManyPermissions(req, ctx) {
      for (const item of req.permission) {
        if (!(await hasPermission(item, ctx))) {
          return { hasPermission: false }
        }
      }
      return { hasPermission: true }
    }
  }))
}
