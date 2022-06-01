import {
  ICommunicationsController,
  subscribeParcelSceneToCommsMessages,
  unsubscribeParcelSceneToCommsMessages
} from 'shared/comms/sceneSubscriptions'
import { ExposableAPI } from 'shared/apis/ExposableAPI'
import { EngineAPI } from 'shared/apis/EngineAPI'
import { ParcelIdentity } from './ParcelIdentity'
import { PeerInformation } from 'shared/comms/interface/types'
import { sendParcelSceneCommsMessage } from './../../comms'

// @registerAPI('CommunicationsController')
// export class CommunicationsController extends ExposableAPI implements ICommunicationsController {
//   parcelIdentity = this.options.getAPIInstance(ParcelIdentity)
//   engineAPI = this.options.getAPIInstance(EngineAPI)

//   get cid() {
//     return this.parcelIdentity.cid
//   }

//   constructor(options: APIOptions) {
//     super(options)
//     subscribeParcelSceneToCommsMessages(this)
//   }

//   apiWillUnmount() {
//     // Unsubscribe this parcel from events
//     unsubscribeParcelSceneToCommsMessages(this)
//   }

//   receiveCommsMessage(message: string, sender: PeerInformation) {
//     this.engineAPI.sendSubscriptionEvent('comms', {
//       message,
//       sender: sender.uuid
//     })
//   }

//   @exposeMethod
//   async send(message: string): Promise<void> {
//     sendParcelSceneCommsMessage(this.cid, message)
//   }
// }
import { RpcServerPort } from '@dcl/rpc'
import { PortContext } from './context'
import * as codegen from '@dcl/rpc/dist/codegen'

import { CommunicationsControllerServiceDefinition } from './../gen/CommunicationsController'

export function CommunicationsControllerServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, CommunicationsControllerServiceDefinition, async () => ({
    async init(_req, ctx) {
      // todo: this is the subscribe of EngineAPI
      if (!ctx.EngineAPI.subscribedEvents['comms']) {
        ctx.EngineAPI.parcelSceneAPI.on('comms', (data: any) => {
          if (ctx.EngineAPI.subscribedEvents['comms']) {
            ctx.eventChannel.push({ id: 'comms', data }).catch((error) => ctx.DevTools.logger.error(error))
          }
        })
        ctx.EngineAPI.subscribedEvents['comms'] = true
      }
      return {}
    },
    async realSend(req) {
      sendParcelSceneCommsMessage(this.cid, req.message)
      return {}
    }
  }))
}
