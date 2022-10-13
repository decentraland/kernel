import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { ExperimentalApiServiceDefinition } from 'shared/protocol/decentraland/kernel/apis/experimental_api.gen'

export function createExperimentalApiServiceClient<Context>(clientPort: RpcClientPort) {
  return codegen.loadService<Context, ExperimentalApiServiceDefinition>(clientPort, ExperimentalApiServiceDefinition)
}
