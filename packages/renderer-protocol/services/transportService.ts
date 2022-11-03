import { RpcClientPort, Transport, TransportEvents } from '@dcl/rpc'
import * as codegen from '@dcl/rpc/dist/codegen'
import mitt from 'mitt'
import { Payload, TransportServiceDefinition } from '@dcl/protocol/out-ts/decentraland/renderer/transport.gen'
import { createRendererProtocolInverseRpcServer } from '../inverseRpc/rpcServer'
import { AsyncQueue } from '@well-known-components/pushable-channel'

function createRpcTransport<Context>(
  transportService: codegen.RpcClientModule<TransportServiceDefinition, Context>
): Transport {
  const events = mitt<TransportEvents>()
  const queue = new AsyncQueue<Payload>(() => void 0)
  let closed = false

  const stream = transportService.openTransportStream(queue)

  const handler = async () => {
    while (!closed) {
      const iterator = await stream.next()
      const request: Payload = await iterator.value

      events.emit('message', request.payload)
    }
  }

  handler().catch((e) => events.emit('error', e))

  const api: Transport = {
    ...events,
    sendMessage(message: any) {
      queue.enqueue({
        payload: message
      })
    },
    close() {
      closed = true
      events.emit('close', {})
    }
  }

  return api
}

export function registerRpcTransportService<Context>(clientPort: RpcClientPort) {
  const transportService = codegen.loadService<Context, TransportServiceDefinition>(
    clientPort,
    TransportServiceDefinition
  )

  const rpcTransport: Transport = createRpcTransport(transportService)
  createRendererProtocolInverseRpcServer(rpcTransport)
}
