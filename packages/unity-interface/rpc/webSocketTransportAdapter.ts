import { Transport, TransportEvents } from '@dcl/rpc'
import mitt from 'mitt'
import { CommonRendererOptions } from '../loader'

export const defer = Promise.prototype.then.bind(Promise.resolve())
/** @deprecated
 transport to make compatibility binary and string messages swap
 TODO: Remove on ECS6 Legacy code removal
*/
export function webSocketTransportAdapter(url: string, options: CommonRendererOptions): Transport {
  const socket = new WebSocket(url)

  const queue: Uint8Array[] = []

  ;(socket as any).binaryType = 'arraybuffer'

  socket.addEventListener('open', function () {
    flush()
  })

  function flush() {
    if (socket.readyState === socket.OPEN) {
      for (const $ of queue) {
        send($)
      }
      queue.length = 0
    }
  }

  function send(msg: string | Uint8Array | ArrayBuffer | SharedArrayBuffer) {
    if (msg instanceof Uint8Array || msg instanceof ArrayBuffer || msg instanceof SharedArrayBuffer) {
      socket.send(msg)
    } // ignore string messages
  }

  const events = mitt<TransportEvents>()

  socket.addEventListener('close', () => events.emit('close', {}), { once: true })

  if (socket.readyState === socket.OPEN) {
    defer(() => events.emit('connect', { socket }))
  } else {
    socket.addEventListener('open', () => events.emit('connect', { socket }), { once: true })
  }

  socket.addEventListener('error', (err: any) => {
    if (err.error) {
      events.emit('error', err.error)
    } else if (err.message) {
      events.emit(
        'error',
        Object.assign(new Error(err.message), {
          colno: err.colno,
          error: err.error,
          filename: err.filename,
          lineno: err.lineno,
          message: err.message
        })
      )
    }
  })
  socket.addEventListener('message', (message: { data: any }) => {
    if (message.data instanceof ArrayBuffer) {
      events.emit('message', new Uint8Array(message.data))
    } else {
      const m = JSON.parse(message.data)
      if (m.type && m.payload) {
        options.onMessage(m.type, m.payload)
      }
    }
  })

  const api: Transport = {
    ...events,
    sendMessage(message: any) {
      if (message instanceof Uint8Array) {
        if (socket.readyState === socket.OPEN) {
          send(message)
        } else {
        }
      } else {
        const msg = JSON.stringify({ type: message.type, payload: message.payload })
        socket.send(msg)
      }
    },
    close() {
      socket.close()
    }
  }

  return api
}
