import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { SocialControllerServiceDefinition } from 'shared/protocol/decentraland/kernel/apis/social_controller.gen'

export function createSocialControllerServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = codegen.loadService<Context, SocialControllerServiceDefinition>(
    clientPort,
    SocialControllerServiceDefinition
  )

  return originalService
}
