import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { ExperimentalAPIServiceDefinition } from 'shared/protocol/decentraland/kernel/apis/experimental_api.gen'

export function createExperimentalAPIServiceClient<Context>(clientPort: RpcClientPort) {
  return codegen.loadService<Context, ExperimentalAPIServiceDefinition>(clientPort, ExperimentalAPIServiceDefinition)
}
