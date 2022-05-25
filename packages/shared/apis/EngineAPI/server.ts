import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { Empty, EngineAPIServiceDefinition, EventId, ManyEntityAction } from './gen/EngineAPI'
import { ParcelSceneAPI } from '../../../shared/world/ParcelSceneAPI'

import { pushableChannel } from '@dcl/rpc/dist/push-channel'
import defaultLogger from 'shared/logger'

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
      context.EngineAPI.parcelSceneAPI.sendBatch(req.actions as any)
      return { test: 't323e23e2rue' }
    },
    async startSignal(req: Empty, context) {
      context.EngineAPI.didStart = true
      return { test: 'true' }
    },
    async *subscribe(req: EventId, context) {
      const channel = pushableChannel<any>(function deferCloseChannel() {
        context.EngineAPI.subscribedEvents[req.id] = false
      })

      if (!(req.id in context.EngineAPI.subscribedEvents)) {
        context.EngineAPI.parcelSceneAPI.on(req.id, (data: any) => {
          if (context.EngineAPI.subscribedEvents[req.id]) {
            channel.push(data).catch((error) => defaultLogger.error(error))
          }
        })
      }

      context.EngineAPI.subscribedEvents[req.id] = true

      for await (const message of channel) {
        yield message

        if (!context.EngineAPI.subscribedEvents[req.id]) {
          break
        }
      }

      channel.close()
    },
    async unsubscribe(req: EventId, context) {
      context.EngineAPI.subscribedEvents[req.id] = false
      return { test: 'true' }
    }
  }))
}
