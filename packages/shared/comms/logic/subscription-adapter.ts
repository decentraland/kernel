import { RpcClientModule } from '@dcl/rpc/dist/codegen'
import {
  CommsServiceDefinition,
  PeerTopicSubscriptionResultElem,
  SystemTopicSubscriptionResultElem
} from 'shared/protocol/bff/comms-service.gen'

// This file exists to adapt the subscription system to its final form once the
// protocol repo changes are merged

export function listenSystemMessage(
  commsService: RpcClientModule<CommsServiceDefinition, any>,
  topic: string,
  handler: (data: SystemTopicSubscriptionResultElem) => Promise<void> | void
) {
  const iter = subscribeToSystemMessage(commsService, topic)
  let closed = false
  async function run() {
    for await (const msg of iter) {
      if (closed) break
      await handler(msg)
    }
  }
  run().catch(console.error)
  return {
    close(): Promise<any> {
      closed = true
      return iter.return?.call(void 0)
    }
  }
}

export function listenPeerMessage(
  commsService: RpcClientModule<CommsServiceDefinition, any>,
  topic: string,
  handler: (data: PeerTopicSubscriptionResultElem) => Promise<void> | void
) {
  const iter = subscribeToPeerMessage(commsService, topic)
  let closed = false
  async function run() {
    for await (const msg of iter) {
      if (closed) break
      await handler(msg)
    }
  }
  run().catch(console.error)
  return {
    close(): Promise<any> {
      closed = true
      return iter.return?.call(void 0)
    }
  }
}

export async function* subscribeToSystemMessage(
  commsService: RpcClientModule<CommsServiceDefinition, any>,
  topic: string
) {
  const subscription = await commsService.subscribeToSystemMessages({ topic })
  try {
    for await (const msg of commsService.getSystemMessages(subscription)) {
      yield msg
    }
  } finally {
    await commsService.unsubscribeToSystemMessages(subscription)
  }
}

export async function* subscribeToPeerMessage(
  commsService: RpcClientModule<CommsServiceDefinition, any>,
  topic: string
) {
  const subscription = await commsService.subscribeToPeerMessages({ topic })
  try {
    yield* commsService.getPeerMessages(subscription)
  } finally {
    await commsService.unsubscribeToPeerMessages(subscription)
  }
}
