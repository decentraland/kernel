import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'

import { EnvironmentAPIServiceDefinition } from './gen/EnvironmentAPI'
import { EngineAPIServiceDefinition } from './gen/EngineAPI'

export const createEngineAPIServiceClient = <Context>(clientPort: RpcClientPort) =>
  codegen.loadService<Context, EngineAPIServiceDefinition>(clientPort, EngineAPIServiceDefinition)

export const createEnvironmentAPIServiceClient = <Context>(clientPort: RpcClientPort) =>
  codegen.loadService<Context, EnvironmentAPIServiceDefinition>(clientPort, EnvironmentAPIServiceDefinition)
