import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { EngineAPIServiceDefinition, ManyEntityAction } from '../proto/EngineAPI.gen'

import { PortContextService } from './context'
import { EntityAction, EntityActionType } from 'shared/types'

export function registerEngineAPIServiceServerImplementation(port: RpcServerPort<PortContextService<'EngineAPI'>>) {
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

    async subscribe(req, ctx) {
      if (!(req.eventId in ctx.EngineAPI.subscribedEvents)) {
        ctx.EngineAPI.parcelSceneAPI.on(req.eventId, (data: any) => {
          if (ctx.EngineAPI.subscribedEvents[req.eventId]) {
            ctx.sendSceneEvent(req.eventId as any, data)
          }
        })
        ctx.EngineAPI.subscribedEvents[req.eventId] = true
      }

      return {}
    },
    async unsubscribe(req, ctx) {
      ctx.EngineAPI.subscribedEvents[req.eventId] = false
      return {}
    },
    async pullEvents(req, ctx) {
      const events = ctx.events.map((e) => ({ eventId: e.type, eventData: JSON.stringify(e.data) }))
      ctx.events = []
      return { events }
    }
  }))
}
