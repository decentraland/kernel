import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import {
  EAType,
  EngineApiServiceDefinition,
  EventData,
  ManyEntityAction,
  Payload,
  queryTypeToJSON
} from '@dcl/protocol/out-ts/decentraland/kernel/apis/engine_api.gen'

import { PortContext } from './context'
import { EntityAction, EntityActionType } from 'shared/types'

function getPayload(payloadType: EAType, payload: Payload): any {
  switch (payloadType) {
    case EAType.EAT_OPEN_EXTERNAL_URL: {
      return payload.openExternalUrl?.url
    }
    case EAType.EAT_OPEN_NFT_DIALOG: {
      return payload.openNftDialog
    }
    case EAType.EAT_CREATE_ENTITY: {
      return payload.createEntity
    }
    case EAType.EAT_REMOVE_ENTITY: {
      return payload.removeEntity
    }
    case EAType.EAT_UPDATE_ENTITY_COMPONENT: {
      return payload.updateEntityComponent
    }
    case EAType.EAT_ATTACH_ENTITY_COMPONENT: {
      return payload.attachEntityComponent
    }
    case EAType.EAT_COMPONENT_REMOVED: {
      return payload.componentRemoved
    }
    case EAType.EAT_SET_ENTITY_PARENT: {
      return payload.setEntityParent
    }
    case EAType.EAT_QUERY: {
      return { queryId: queryTypeToJSON(payload.query!.queryId), payload: JSON.parse(payload.query!.payload) }
    }
    case EAType.EAT_COMPONENT_CREATED: {
      return payload.componentCreated
    }
    case EAType.EAT_COMPONENT_DISPOSED: {
      return payload.componentDisposed
    }
    case EAType.EAT_COMPONENT_UPDATED: {
      return payload.componentUpdated
    }
    case EAType.EAT_INIT_MESSAGES_FINISHED: {
      return payload.initMessagesFinished
    }
  }
  return {}
}

export function registerEngineApiServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, EngineApiServiceDefinition, async () => ({
    async sendBatch(req: ManyEntityAction, ctx) {
      const actions: EntityAction[] = []

      for (const action of req.actions) {
        const actionType = eaTypeToStr(action.type)
        if (actionType && action.payload) {
          actions.push({
            type: actionType,
            tag: action.tag,
            payload: getPayload(action.type, action.payload as any)
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
function eaTypeToStr(type: EAType): EntityActionType | null {
  switch (type) {
    case EAType.EAT_UPDATE_ENTITY_COMPONENT:
      return 'UpdateEntityComponent'
    case EAType.EAT_COMPONENT_UPDATED:
      return 'ComponentUpdated'
    case EAType.EAT_COMPONENT_CREATED:
      return 'ComponentCreated'
    case EAType.EAT_CREATE_ENTITY:
      return 'CreateEntity'
    case EAType.EAT_OPEN_EXTERNAL_URL:
      return 'OpenExternalUrl'
    case EAType.EAT_OPEN_NFT_DIALOG:
      return 'OpenNFTDialog'
    case EAType.EAT_REMOVE_ENTITY:
      return 'RemoveEntity'
    case EAType.EAT_ATTACH_ENTITY_COMPONENT:
      return 'AttachEntityComponent'
    case EAType.EAT_COMPONENT_REMOVED:
      return 'ComponentRemoved'
    case EAType.EAT_SET_ENTITY_PARENT:
      return 'SetEntityParent'
    case EAType.EAT_QUERY:
      return 'Query'
    case EAType.EAT_COMPONENT_CREATED:
      return 'ComponentCreated'
    case EAType.EAT_COMPONENT_DISPOSED:
      return 'ComponentDisposed'
    case EAType.EAT_COMPONENT_UPDATED:
      return 'ComponentUpdated'
    case EAType.EAT_INIT_MESSAGES_FINISHED:
      return 'InitMessagesFinished'
  }
  return null
}
