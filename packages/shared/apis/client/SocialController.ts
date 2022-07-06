import * as codegen from '@dcl/rpc/dist/codegen'
import type { RpcClientPort } from '@dcl/rpc/dist/types'
import { SocialControllerServiceDefinition } from '../proto/SocialController.gen'

export function createSocialControllerServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = codegen.loadService<Context, SocialControllerServiceDefinition>(
    clientPort,
    SocialControllerServiceDefinition
  )

  return originalService
}
