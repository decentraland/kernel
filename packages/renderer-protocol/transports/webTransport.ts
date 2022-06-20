import { Transport, TransportEvents } from '@dcl/rpc'
import mitt from 'mitt'

export type WebTransportOptions = {
  unityModule: any
}

export function webTransport(options: WebTransportOptions): Transport {
  const events = mitt<TransportEvents>()
  const ALLOC_SIZE = 8388608
  const heapPtr: number = options.unityModule._malloc(ALLOC_SIZE)
  const cCall = options.unityModule.cwrap('call_BinaryMessage', null, ['number', 'number'])

  let isClosed = false
  return {
    ...events,
    sendMessage(message) {
      options.unityModule.HEAPU8.set(message, heapPtr)
      cCall(heapPtr, message.length)
    },
    close() {
      if (!isClosed) {
        isClosed = true
        events.emit('close', {})
      }
    }
  }
}
