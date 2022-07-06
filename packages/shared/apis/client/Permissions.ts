import * as codegen from '@dcl/rpc/dist/codegen'
import type { RpcClientPort } from '@dcl/rpc/dist/types'
import { PermissionsServiceDefinition } from '../proto/Permissions.gen'

export function createPermissionsServiceClient<Context>(clientPort: RpcClientPort) {
  return codegen.loadService<Context, PermissionsServiceDefinition>(clientPort, PermissionsServiceDefinition)
}
