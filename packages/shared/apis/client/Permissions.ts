import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { PermissionsServiceDefinition, permissionItemFromJSON } from '../gen/Permissions'

export async function createPermissionsServiceClient<Context>(clientPort: RpcClientPort) {
  const realService = await codegen.loadService<Context, PermissionsServiceDefinition>(
    clientPort,
    PermissionsServiceDefinition
  )

  return {
    ...realService,
    async hasManyPermissions(items: string[]): Promise<boolean> {
      return (await realService.realHasManyPermissions({ permission: items.map(permissionItemFromJSON) })).hasPermission
    },
    async hasPermissions(item: string): Promise<boolean> {
      return (await realService.realHasPermission({ permission: permissionItemFromJSON(item) })).hasPermission
    }
  }
}
