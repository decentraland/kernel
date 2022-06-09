import { RpcServerPort } from '@dcl/rpc'
import { PortContext } from './context'
import * as codegen from '@dcl/rpc/dist/codegen'
import { AsyncQueue } from '@dcl/rpc/dist/push-channel'

import { SocialControllerServiceDefinition, SocialEvent } from '../proto/SocialController'
import { avatarMessageObservable } from 'shared/comms/peers'

export function registerSocialControllerServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, SocialControllerServiceDefinition, async (port, ctx) => {
    return {
      getAvatarEvents(): AsyncGenerator<SocialEvent> {
        const messageQueue = new AsyncQueue<SocialEvent>((_, action) => {
          if (action == 'close') {
            avatarMessageObservable.remove(observer)
          }
        })
        const observer = avatarMessageObservable.add((event) => {
          messageQueue.enqueue({
            event: event.type,
            payload: JSON.stringify(event)
          })
        })
        return messageQueue
      }
    }
  })
}
