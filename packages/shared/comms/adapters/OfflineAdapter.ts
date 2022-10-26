import mitt from 'mitt'
import { CommsAdapterEvents, MinimumCommunicationsAdapter, SendHints } from './types'

export class OfflineAdapter implements MinimumCommunicationsAdapter {
  events = mitt<CommsAdapterEvents>()

  constructor() {}
  async disconnect(error?: Error | undefined): Promise<void> {}
  send(data: Uint8Array, hints: SendHints): void {}
  async connect(): Promise<void> {}
}
