import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { EnvironmentAPIServiceDefinition } from '../gen/EnvironmentAPI'

export async function createEnvironmentAPIServiceClient<Context>(clientPort: RpcClientPort) {
  const realService = await codegen.loadService<Context, EnvironmentAPIServiceDefinition>(
    clientPort,
    EnvironmentAPIServiceDefinition
  )
  return realService
}
