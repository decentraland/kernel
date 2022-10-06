import {
  ICommunicationsController,
  subscribeParcelSceneToCommsMessages,
  unsubscribeParcelSceneToCommsMessages
} from './../../comms/sceneSubscriptions'

import { PeerInformation } from './../../comms/interface/types'

import { RpcServerPort } from '@dcl/rpc'
import * as codegen from '@dcl/rpc/dist/codegen'
import { sendParcelSceneCommsMessage } from './../../comms'
import { PortContext } from './context'
import { CommunicationsControllerServiceDefinition } from 'shared/protocol/kernel/apis/CommunicationsController.gen'

export function registerCommunicationsControllerServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, CommunicationsControllerServiceDefinition, async (port, ctx) => {
    const commsController: ICommunicationsController = {
      cid: ctx.sceneData.id,
      receiveCommsMessage(message: string, sender: PeerInformation) {
        ctx.sendSceneEvent('comms', {
          message,
          sender: sender.ethereumAddress || sender.uuid
        })
      }
    }

    subscribeParcelSceneToCommsMessages(commsController)

    port.on('close', () => {
      unsubscribeParcelSceneToCommsMessages(commsController)
    })

    return {
      async send(req, ctx) {
        sendParcelSceneCommsMessage(ctx.sceneData.id, req.message)
        return {}
      }
    }
  })
}
