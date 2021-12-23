import { PermissionItem, Permissions } from 'shared/apis/Permissions'

export interface WebSocketClassOptions {
  permission: Permissions
  previewMode: boolean
  log: any
}

export function createWebSocket({ permission, previewMode, log }: WebSocketClassOptions) {
  return class RestrictedWebSocket extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      if (url.toString().toLowerCase().substr(0, 4) !== 'wss:') {
        if (previewMode) {
          log("Warning: can't connect to unsafe WebSocket server in deployed scenes.")
        } else {
          throw new Error("Can't connect to unsafe WebSocket server")
        }
      }
      void permission.hasPermission(PermissionItem.USE_WEBSOCKET).then((result) => {
        if (!result) {
          this.close()
          throw new Error("This scene doesn't have allowed to use WebSocket")
        }
      })

      super(url.toString(), protocols)
    }
  }
}
