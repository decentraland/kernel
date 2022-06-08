import { RpcServerPort } from '@dcl/rpc'
import { PortContext } from './context'
import * as codegen from '@dcl/rpc/dist/codegen'

import { SocialControllerServiceDefinition } from '../proto/SocialController'
import { avatarMessageObservable } from 'shared/comms/peers'

export function registerSocialControllerServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, SocialControllerServiceDefinition, async () => ({
    async init(_req, ctx) {
      const observer = avatarMessageObservable.add((event: any) => {
        if (!ctx.eventChannel.isClosed()) {
          ctx.eventChannel.push({ id: 'AVATAR_OBSERVABLE', data: event }).catch((err) => ctx.DevTools.logger.error(err))
        } else {
          avatarMessageObservable.remove(observer)
        }
      })
      return {}
    }
  }))
}
