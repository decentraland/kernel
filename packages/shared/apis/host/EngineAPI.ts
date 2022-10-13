import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import {
  EAType,
  eATypeToJSON,
  EngineAPIServiceDefinition,
  EventData,
  ManyEntityAction,
  Payload,
  queryTypeToJSON
} from 'shared/protocol/kernel/apis/EngineAPI.gen'

import { PortContext } from './context'
import { EntityAction, EntityActionType } from 'shared/types'

function getPayload(payloadType: EAType, payload: Payload): any {
  switch (payloadType) {
    case EAType.OpenExternalUrl: {
      return payload.openExternalUrl?.url
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
      return { queryId: queryTypeToJSON(payload.query!.queryId), payload: JSON.parse(payload.query!.payload) }
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

export function registerEngineAPIServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, EngineAPIServiceDefinition, async () => ({
    async sendBatch(req: ManyEntityAction, ctx) {
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

      if (actions.length) {
        ctx.sendBatch(actions)
      }

      const events: EventData[] = ctx.events

      if (events.length) {
        ctx.events = []
      }

      return { events }
    },

    async subscribe(req, ctx) {
      ctx.subscribedEvents.add(req.eventId)
      return {}
    },
    async unsubscribe(req, ctx) {
      ctx.subscribedEvents.delete(req.eventId)
      return {}
    }
  }))
}
