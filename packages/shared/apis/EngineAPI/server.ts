import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { Empty, EngineAPIServiceDefinition, EventId, ManyEntityAction } from './gen/EngineAPI'
import { ParcelSceneAPI } from '../../../shared/world/ParcelSceneAPI'
import { future } from 'fp-future'

export type EngineAPIContext = {
  didStart: boolean
  parcelSceneAPI: ParcelSceneAPI
  subscribedEvents: { [event: string]: boolean }
}
export function registerEngineAPIServiceServerImplementation(port: RpcServerPort<EngineAPIContext>) {
  codegen.registerService(port, EngineAPIServiceDefinition, async () => ({
    async sendBatch(req: ManyEntityAction, context) {
      context.parcelSceneAPI.sendBatch(req.actions)
      return {}
    },
    async startSignal(req: Empty, context) {
      context.didStart = true
      return {}
    },
    async *subscribe(req: EventId, context) {
      let fut = future()

      if (!(req.id in context.subscribedEvents)) {
        context.parcelSceneAPI.on(req.id, (data: any) => {
          if (context.subscribedEvents[req.id]) {
            // context.sendSubscriptionEvent(req.id, data)
            fut.resolve(data)
          }
        })
      }

      context.subscribedEvents[req.id] = true

      while (context.subscribedEvents[req.id]) {
        const data = await fut
        yield data

        fut = future()
      }
    },
    async unsubscribe(req: EventId, context) {
      context.subscribedEvents[req.id] = false
      return {}
    }
  }))
}
