import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { Empty, EngineAPIServiceDefinition, EventId, ManyEntityAction } from './gen/EngineAPI'
import { ParcelSceneAPI } from '../../../shared/world/ParcelSceneAPI'
import { future } from 'fp-future'
import { EntityAction } from 'shared/types'

export type EngineAPIContext = {
  EngineAPI: {
    didStart: boolean
    parcelSceneAPI: ParcelSceneAPI
    subscribedEvents: { [event: string]: boolean }
  }
}
export function registerEngineAPIServiceServerImplementation(port: RpcServerPort<EngineAPIContext>) {
  codegen.registerService(port, EngineAPIServiceDefinition, async () => ({
    async sendBatch(req: ManyEntityAction, context) {
      context.EngineAPI.parcelSceneAPI.sendBatch(req.actions as any as EntityAction[])
      return {}
    },
    async startSignal(req: Empty, context) {
      context.EngineAPI.didStart = true
      return {}
    },
    async *subscribe(req: EventId, context) {
      let fut = future()

      if (!(req.id in context.EngineAPI.subscribedEvents)) {
        context.EngineAPI.parcelSceneAPI.on(req.id, (data: any) => {
          if (context.EngineAPI.subscribedEvents[req.id]) {
            // context.EngineAPI.sendSubscriptionEvent(req.id, data)
            fut.resolve(data)
          }
        })
      }

      context.EngineAPI.subscribedEvents[req.id] = true

      while (context.EngineAPI.subscribedEvents[req.id]) {
        const data = await fut
        yield data

        fut = future()
      }
    },
    async unsubscribe(req: EventId, context) {
      context.EngineAPI.subscribedEvents[req.id] = false
      return {}
    }
  }))
}
