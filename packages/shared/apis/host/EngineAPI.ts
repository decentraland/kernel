import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { EngineAPIServiceDefinition, ManyEntityAction } from './../gen/EngineAPI'

import defaultLogger from 'shared/logger'
import { PortContext } from './context'
import { EntityAction, EntityActionType } from 'shared/types'

export function registerEngineAPIServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, EngineAPIServiceDefinition, async () => ({
    async sendBatch(req: ManyEntityAction, context) {
      const actions: EntityAction[] = []
      for (const action of req.actions) {
        if (action.payload) {
          actions.push({
            type: action.type as EntityActionType,
            tag: action.tag,
            payload: JSON.parse(action.payload)
          })
        }
      }
      context.EngineAPI.parcelSceneAPI.sendBatch(actions)
      return {}
    },
    async startSignal(_req, context) {
      context.EngineAPI.didStart = true
      return {}
    },

    async realSubscribe(req, ctx) {
      const channel = ctx.EngineAPI.eventChannel

      if (!(req.eventId in ctx.EngineAPI.subscribedEvents)) {
        ctx.EngineAPI.parcelSceneAPI.on(req.eventId, (data: any) => {
          if (ctx.EngineAPI.subscribedEvents[req.eventId]) {
            channel.push({ id: req.eventId, data }).catch((error) => defaultLogger.error(error))
          }
        })
      }

      return {}
    },
    async realUnsubscribe(req, ctx) {
      ctx.EngineAPI.subscribedEvents[req.eventId] = false
      return {}
    },
    async *streamEvents(req, ctx) {
      const channel = ctx.EngineAPI.eventChannel
      for await (const message of channel) {
        yield { eventId: message.id, eventData: message.data }
      }
    }
  }))
}
