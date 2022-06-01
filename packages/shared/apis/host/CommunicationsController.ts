import {
  ICommunicationsController,
  subscribeParcelSceneToCommsMessages,
  unsubscribeParcelSceneToCommsMessages
} from './../../comms/sceneSubscriptions'

import { PeerInformation } from './../../comms/interface/types'

import { sendParcelSceneCommsMessage } from './../../comms'
import { RpcServerPort } from '@dcl/rpc'
import { PortContext } from './context'
import * as codegen from '@dcl/rpc/dist/codegen'

import { CommunicationsControllerServiceDefinition } from './../gen/CommunicationsController'

export function CommunicationsControllerServiceServerImplementation(port: RpcServerPort<PortContext>) {
  let commsController: ICommunicationsController | null = null

  codegen.registerService(port, CommunicationsControllerServiceDefinition, async () => ({
    async init(_req, ctx) {
      commsController = {
        cid: ctx.ParcelIdentity.cid,
        receiveCommsMessage(message: string, sender: PeerInformation) {
          const data = {
            message,
            sender: sender.uuid
          }
          ctx.eventChannel.push({ id: 'comms', data }).catch((error) => ctx.DevTools.logger.error(error))
        }
      }

      subscribeParcelSceneToCommsMessages(commsController)
      return {}
    },
    async dispose() {
      if (commsController !== null) {
        unsubscribeParcelSceneToCommsMessages(commsController)
      }
    },
    async realSend(req, ctx) {
      sendParcelSceneCommsMessage(ctx.ParcelIdentity.cid, req.message)
      return {}
    }
  }))
}
