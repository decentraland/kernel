import future from 'fp-future'
import type { UnityGame } from '@dcl/unity-renderer/src/index'
import { CommonRendererOptions } from './loader'
import { webSocketTransportAdapter } from './rpc/webSocketTransportAdapter'
import { createRendererRpcClient } from './rpc/rpcClient'

/** This connects the local game to a native client via WebSocket */
export async function initializeUnityEditor(wsUrl: string, options: CommonRendererOptions): Promise<UnityGame> {

  const transport = webSocketTransportAdapter(wsUrl, options)

  const engineStartedFuture = future<UnityGame>()

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

  transport.on('connect', () => engineStartedFuture.resolve(gameInstance))

  await createRendererRpcClient(transport)

  return engineStartedFuture
}
