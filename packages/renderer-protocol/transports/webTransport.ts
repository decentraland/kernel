import { Transport, TransportEvents } from '@dcl/rpc'
import mitt from 'mitt'

export type WebTransportOptions = {
  wasmModule: any
}

export function webTransport(options: WebTransportOptions): Transport {
  const events = mitt<TransportEvents>()
  const ALLOC_SIZE = 8388608
  let heapPtr: number
  let sendMessageToRenderer: undefined | ((ptr: number, length: number) => void) = undefined

  if (!!options.wasmModule._call_BinaryMessage) {
    heapPtr = options.wasmModule._malloc(ALLOC_SIZE)
    sendMessageToRenderer = options.wasmModule.cwrap('call_BinaryMessage', null, ['number', 'number'])
  }

  let isClosed = false

  ;(globalThis as any).DCL.BinaryMessageFromEngine = function (data: Uint8Array) {
    // TODO: remove this. The queueMicrotask handles the sequential calls when a `send` 
    //  is invoked and the answer is immediately invoked 
    // This should be handlering by `@dcl/rpc` and delete this workaround
    queueMicrotask(() => {
      const copiedData = new Uint8Array(data)
      events.emit('message', copiedData)
    })
  }

  const transport: Transport = {
    ...events,
    sendMessage(message) {
      // TODO: remove this, see the comment above
      queueMicrotask(() => {
        if (!!sendMessageToRenderer && !isClosed) {
          options.wasmModule.HEAPU8.set(message, heapPtr)
          sendMessageToRenderer(heapPtr, message.length)
        }
      })
    },
    close() {
      if (!isClosed) {
        isClosed = true
        events.emit('close', {})
      }
    }
  }

  queueMicrotask(() => events.emit('connect', {}))

  return transport
}
