import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import {
  EAType,
  EngineAPIServiceDefinition,
  EventData,
  ManyEntityAction,
  Payload,
  queryTypeToJSON
} from 'shared/protocol/decentraland/kernel/apis/engine_api.gen'

import { PortContext } from './context'
import { EntityAction, EntityActionType } from 'shared/types'

function getPayload(payloadType: EAType, payload: Payload): any {
  switch (payloadType) {
    case EAType.EA_TYPE_OPEN_EXTERNAL_URL: {
      return payload.openExternalUrl?.url
    }
    case EAType.EA_TYPE_OPEN_NFT_DIALOG: {
      return payload.openNftDialog
    }
    case EAType.EA_TYPE_CREATE_ENTITY: {
      return payload.createEntity
    }
    case EAType.EA_TYPE_REMOVE_ENTITY: {
      return payload.removeEntity
    }
    case EAType.EA_TYPE_UPDATE_ENTITY_COMPONENT: {
      return payload.updateEntityComponent
    }
    case EAType.EA_TYPE_ATTACH_ENTITY_COMPONENT: {
      return payload.attachEntityComponent
    }
    case EAType.EA_TYPE_COMPONENT_REMOVED: {
      return payload.componentRemoved
    }
    case EAType.EA_TYPE_SET_ENTITY_PARENT: {
      return payload.setEntityParent
    }
    case EAType.EA_TYPE_QUERY: {
      return { queryId: queryTypeToJSON(payload.query!.queryId), payload: JSON.parse(payload.query!.payload) }
    }
    case EAType.EA_TYPE_COMPONENT_CREATED: {
      return payload.componentCreated
    }
    case EAType.EA_TYPE_COMPONENT_DISPOSED: {
      return payload.componentDisposed
    }
    case EAType.EA_TYPE_COMPONENT_UPDATED: {
      return payload.componentUpdated
    }
    case EAType.EA_TYPE_INIT_MESSAGES_FINISHED: {
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
            type: eaTypeToStr(action.type),
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
function eaTypeToStr(type: EAType): EntityActionType {
  switch (type) {
    case EAType.EA_TYPE_OPEN_EXTERNAL_URL:
      return 'OpenExternalUrl'
    case EAType.EA_TYPE_OPEN_NFT_DIALOG:
      return 'OpenNFTDialog'
    case EAType.EA_TYPE_CREATE_ENTITY:
      return 'CreateEntity'
    case EAType.EA_TYPE_REMOVE_ENTITY:
      return 'RemoveEntity'
    case EAType.EA_TYPE_UPDATE_ENTITY_COMPONENT:
      return 'UpdateEntityComponent'
    case EAType.EA_TYPE_ATTACH_ENTITY_COMPONENT:
      return 'AttachEntityComponent'
    case EAType.EA_TYPE_COMPONENT_REMOVED:
      return 'ComponentRemoved'
    case EAType.EA_TYPE_SET_ENTITY_PARENT:
      return 'SetEntityParent'
    case EAType.EA_TYPE_QUERY:
      return 'Query'
    case EAType.EA_TYPE_COMPONENT_CREATED:
      return 'ComponentCreated'
    case EAType.EA_TYPE_COMPONENT_DISPOSED:
      return 'ComponentDisposed'
    case EAType.EA_TYPE_COMPONENT_UPDATED:
      return 'ComponentUpdated'
    case EAType.EA_TYPE_INIT_MESSAGES_FINISHED:
      return 'InitMessagesFinished'
  }
  return 'unknown' as EntityActionType
}
