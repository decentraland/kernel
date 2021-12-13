import { ExposableAPI } from './ExposableAPI'
import { Permissions, PermissionItem } from './Permissions'

export class RestrictedExposableAPI extends ExposableAPI {
  permissions = this.options.getAPIInstance(Permissions)

  async ensureHasPermissions(permissionItems: PermissionItem[]) {
    if (!(await this.permissions.hasManyPermissions(permissionItems))) {
      throw new Error(`This scene doesn't have some of the next permissions: ${permissionItems}. Scene permissions: ${this.permissions.permissionGranted}`)
    }
  }
}
