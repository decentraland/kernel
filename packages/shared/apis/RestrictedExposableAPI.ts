import { ExposableAPI } from './ExposableAPI'
import { Permissions, PermissionItem } from './Permissions'

export class RestrictedExposableAPI extends ExposableAPI {
  permissions = this.options.getAPIInstance(Permissions)

  async assertHasPermissions(permissionItems: PermissionItem[]) {
    const testPermission = await this.permissions.hasManyPermissions(permissionItems)

    if (!testPermission) {
      throw new Error(`This scene doesn't have some of the next permissions: ${permissionItems}.`)
    }
  }
}
