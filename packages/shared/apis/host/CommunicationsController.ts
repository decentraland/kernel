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
      receiveCommsMessage(data: Uint8Array, sender: PeerInformation) {
        const message = new TextDecoder().decode(data)
        ctx.sendSceneEvent('comms', {
          message,
          sender: sender.ethereumAddress
        })
      }
    }

    subscribeParcelSceneToCommsMessages(commsController)

    port.on('close', () => {
      unsubscribeParcelSceneToCommsMessages(commsController)
    })

    return {
      async send(req, ctx) {
        const message = new TextEncoder().encode(req.message)
        sendParcelSceneCommsMessage(ctx.sceneData.id, message)
        return {}
      }
    }
  })
}
