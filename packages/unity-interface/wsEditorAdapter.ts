import future from 'fp-future'
import type { UnityGame } from '@dcl/unity-renderer/src/index'
import { Transport } from '@dcl/rpc'

/** This connects the local game to a native client via WebSocket */
export async function initializeUnityEditor(wsTransport: Transport): Promise<UnityGame> {
  const engineStartedFuture = future<UnityGame>()

  const gameInstance: UnityGame = {
    Module: {},
    SendMessage(_obj, type, payload) {
      wsTransport.sendMessage({ type, payload } as any)
    },
    SetFullscreen() {
      // stub
    },
    async Quit() {
      // stub
    }
  }

  wsTransport.on('connect', () => engineStartedFuture.resolve(gameInstance))
  return engineStartedFuture
}
