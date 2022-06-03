import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { SocialControllerServiceDefinition } from '../gen/SocialController'

export async function createSocialControllerServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = await codegen.loadService<Context, SocialControllerServiceDefinition>(
    clientPort,
    SocialControllerServiceDefinition
  )

  return originalService
}
