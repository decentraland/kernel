import mitt from 'mitt'
import { VoiceHandler } from 'shared/voiceChat/VoiceHandler'
import { CommsAdapterEvents, MinimumCommunicationsAdapter, SendHints } from './types'
import { createOpusVoiceHandler } from './voice/opusVoiceHandler'

export class OfflineAdapter implements MinimumCommunicationsAdapter {
  events = mitt<CommsAdapterEvents>()

  constructor() {}
  async getVoiceHandler(): Promise<VoiceHandler> {
    return createOpusVoiceHandler()
  }
  async disconnect(error?: Error | undefined): Promise<void> {}
  send(data: Uint8Array, hints: SendHints): void {}
  async connect(): Promise<void> {}
}
