import { RpcServerPort } from '@dcl/rpc'
import { PortContext } from './context'
import * as codegen from '@dcl/rpc/dist/codegen'

import { SocialControllerServiceDefinition } from './../gen/SocialController'
import { avatarMessageObservable } from 'shared/comms/peers'
import defaultLogger from 'shared/logger'

export function registerSocialControllerServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, SocialControllerServiceDefinition, async () => ({
    async init(_req, ctx) {
      avatarMessageObservable.add((event: any) => {
        ctx.eventChannel.push({ id: 'AVATAR_OBSERVABLE', data: event }).catch((err) => defaultLogger.error(err))
      })
      return {}
    }
  }))
}
