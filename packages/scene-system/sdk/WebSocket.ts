export interface WebSocketClassOptions {
  canUseWebsocket: boolean
  previewMode: boolean
  log(...a: any[]): void
}

export function createWebSocket({ canUseWebsocket, previewMode, log }: WebSocketClassOptions) {
  return class RestrictedWebSocket extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      if (url.toString().toLowerCase().substr(0, 4) !== 'wss:') {
        if (previewMode) {
          log(
            "⚠️ Warning: can't connect to unsafe WebSocket (ws) server in deployed scenes, consider upgrading to wss."
          )
        } else {
          throw new Error("Can't connect to unsafe WebSocket server")
        }
      }

      if (!canUseWebsocket) {
        throw new Error("This scene doesn't have allowed to use WebSocket")
      }

      super(url.toString(), protocols)
    }
  }
}
