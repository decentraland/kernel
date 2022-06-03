import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { ExperimentalAPIServiceDefinition } from '../gen/ExperimentalAPI'

export async function createExperimentalAPIServiceClient<Context>(clientPort: RpcClientPort) {
  return codegen.loadService<Context, ExperimentalAPIServiceDefinition>(clientPort, ExperimentalAPIServiceDefinition)
}
