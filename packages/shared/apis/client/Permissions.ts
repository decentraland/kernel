import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { PermissionsServiceDefinition } from 'shared/protocol/decentraland/kernel/apis/permissions.gen'

export function createPermissionsServiceClient<Context>(clientPort: RpcClientPort) {
  return codegen.loadService<Context, PermissionsServiceDefinition>(clientPort, PermissionsServiceDefinition)
}
