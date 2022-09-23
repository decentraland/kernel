import { store } from 'shared/store/isolatedStore'
import { commsLogger } from './context'
import { getCommsContext } from './selectors'

export type CommsVersion = 'v1' | 'v2' | 'v3' | 'v4' | 'offline'
export type CommsMode = CommsV1Mode | CommsV2Mode
export type CommsV1Mode = 'local' | 'remote'
export type CommsV2Mode = 'p2p' | 'server'

export function sendPublicChatMessage(message: string) {
  const commsContext = getCommsContext(store.getState())

  commsContext?.worldInstanceConnection
    .sendChatMessage({
      message
    })
    .catch((e) => commsLogger.warn(`error while sending message `, e))
}

export function sendParcelSceneCommsMessage(sceneId: string, data: Uint8Array) {
  const commsContext = getCommsContext(store.getState())

  commsContext?.worldInstanceConnection
    .sendParcelSceneMessage({
      data,
      sceneId
    })
    .catch((e) => commsLogger.warn(`error while sending message `, e))
}
