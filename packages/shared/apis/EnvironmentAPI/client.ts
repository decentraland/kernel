import { loadService } from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { EnvirnmentAPIServiceDefinition } from './gen/EnvironmentAPI'

export const createEnvironmentAPIServiceClient = <Context>(clientPort: RpcClientPort) =>
  loadService<Context, EnvirnmentAPIServiceDefinition>(clientPort, EnvirnmentAPIServiceDefinition)
