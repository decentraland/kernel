import type { UnityGame } from '@dcl/unity-renderer/src/index'
import { CommonRendererOptions } from './loader'
import { webSocketTransportAdapter } from '../renderer-protocol/transports/webSocketTransportAdapter'
import { createRendererRpcClient } from '../renderer-protocol/rpcClient'
import { RendererProtocol } from '../renderer-protocol/types'

/** This connects the local game to a native client via WebSocket */
export async function initializeUnityEditor(
  wsUrl: string,
  options: CommonRendererOptions
): Promise<UnityGame & RendererProtocol> {
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

  const protocol = await createRendererRpcClient(transport)

  const ping = () => {
    setTimeout(async () => {
      console.log('[RPC] Send ping...')
      await protocol.pingService.ping({})
      console.log('[RPC] Pong!')
      ping()
    }, 1000)
  }
  ping()

  return { ...gameInstance, ...protocol }
}
