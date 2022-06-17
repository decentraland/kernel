import { Transport, TransportEvents } from '@dcl/rpc'
import mitt from 'mitt'

export const defer = Promise.prototype.then.bind(Promise.resolve())

export function webSocketTransport(socket: WebSocket): Transport {
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
    } else throw new Error(`WebSocketTransport only accepts Uint8Array`)
  }

  const events = mitt<TransportEvents>()

  socket.addEventListener('close', () => events.emit('close', {}), { once: true })

  if (socket.readyState === socket.OPEN) {
    defer(() => events.emit('connect', {}))
  } else {
    socket.addEventListener('open', () => events.emit('connect', {}), { once: true })
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
      throw new Error(`WebSocketTransport: Received unknown type of message, expecting Uint8Array`)
    }
  })

  const api: Transport = {
    ...events,
    sendMessage(message: any) {
      if (message instanceof Uint8Array) {
        if (socket.readyState === socket.OPEN) {
          send(message)
        } else {
          queue.push(message)
        }
      } else {
        throw new Error(`WebSocketTransport: Received unknown type of message, expecting Uint8Array`)
      }
    },
    close() {
      socket.close()
    }
  }

  return api
}
