import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort, RpcClientPort } from '@dcl/rpc/dist/types'
import { EngineAPIServiceDefinition, EventId, ManyEntityAction } from './gen/EngineAPI'

import { pushableChannel } from '@dcl/rpc/dist/push-channel'
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
    async startSignal(req, context) {
      context.EngineAPI.didStart = true
      return {}
    },
    async *subscribe(req: EventId, context) {
      const channel = pushableChannel<any>(function deferCloseChannel() {
        context.EngineAPI.subscribedEvents[req.id] = false
      })

      if (!(req.id in context.EngineAPI.subscribedEvents)) {
        context.EngineAPI.parcelSceneAPI.on(req.id, (data: any) => {
          if (context.EngineAPI.subscribedEvents[req.id]) {
            channel.push(JSON.stringify(data)).catch((error) => defaultLogger.error(error))
          }
        })
      }

      context.EngineAPI.subscribedEvents[req.id] = true

      for await (const message of channel) {
        yield { payload: message }

        if (!context.EngineAPI.subscribedEvents[req.id]) {
          break
        }
      }

      channel.close()
    },
    async unsubscribe(req: EventId, context) {
      context.EngineAPI.subscribedEvents[req.id] = false
      return {}
    }
  }))
}

export const createEngineAPIServiceClient = <Context>(clientPort: RpcClientPort) =>
  codegen.loadService<Context, EngineAPIServiceDefinition>(clientPort, EngineAPIServiceDefinition)
