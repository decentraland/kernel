import type { UnityGame } from '@dcl/unity-renderer/src/index'
import { CommonRendererOptions } from './loader'
import { webSocketTransportAdapter } from '../renderer-protocol/transports/webSocketTransportAdapter'
import { createRendererRpcClient } from '../renderer-protocol/rpcClient'

/** This connects the local game to a native client via WebSocket */
export async function initializeUnityEditor(wsUrl: string, options: CommonRendererOptions): Promise<UnityGame> {
  const transport = webSocketTransportAdapter(wsUrl, options)

  const gameInstance: UnityGame = {
    Module: {},
    SendMessage(_obj, type, payload) {
      transport.sendMessage({ type, payload } as any)
    },
    SetFullscreen() {
      // stub
    },
    async Quit() {
      // stub
    }
  }

  createRendererRpcClient(transport).catch((e) => {})

  return gameInstance
}
