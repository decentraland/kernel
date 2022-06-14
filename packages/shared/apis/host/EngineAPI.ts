import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { EAType, eATypeToJSON, EngineAPIServiceDefinition, ManyEntityAction, Payload } from '../proto/EngineAPI.gen'

import { PortContextService } from './context'
import { EntityAction, EntityActionType } from 'shared/types'

function getPayload(payloadType: EAType, payload: Payload): any {
  switch (payloadType) {
    case EAType.OpenExternalUrl: {
      return payload.openExternalUrl
    }
    case EAType.OpenNFTDialog: {
      return payload.openNftDialog
    }
    case EAType.CreateEntity: {
      return payload.createEntity
    }
    case EAType.RemoveEntity: {
      return payload.removeEntity
    }
    case EAType.UpdateEntityComponent: {
      return payload.updateEntityComponent
    }
    case EAType.AttachEntityComponent: {
      return payload.attachEntityComponent
    }
    case EAType.ComponentRemoved: {
      return payload.componentRemoved
    }
    case EAType.SetEntityParent: {
      return payload.setEntityParent
    }
    case EAType.Query: {
      return payload.query
    }
    case EAType.ComponentCreated: {
      return payload.componentCreated
    }
    case EAType.ComponentDisposed: {
      return payload.componentDisposed
    }
    case EAType.ComponentUpdated: {
      return payload.componentUpdated
    }
    case EAType.InitMessagesFinished: {
      return payload.initMessagesFinished
    }
  }
  return {}
}

export function registerEngineAPIServiceServerImplementation(port: RpcServerPort<PortContextService<'EngineAPI'>>) {
  codegen.registerService(port, EngineAPIServiceDefinition, async () => ({
    async sendBatch(req: ManyEntityAction, context) {
      const actions: EntityAction[] = []
      for (const action of req.actions) {
        if (action.payload) {
          actions.push({
            type: eATypeToJSON(action.type) as EntityActionType,
            tag: action.tag,
            payload: getPayload(action.type, action.payload)
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
