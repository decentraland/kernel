import { PermissionItem, Permissions } from 'shared/apis/Permissions'

export function createWebSocket(permission: Permissions) {
  return class RestrictedWebSocket extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      if (url.toString().toLowerCase().substr(0, 4) !== 'wss:') {
        throw new Error("Can't connect to unsafe WebSocket server")
      }
      void permission.hasPermission(PermissionItem.USE_WEBSOCKET).then((result) => {
        if (!result) {
          this.close()
          throw new Error("This scene doesn't have allowed to use WebSocket")
        }
      })

      super(url, protocols)
    }
  }
}
