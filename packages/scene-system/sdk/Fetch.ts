import { PermissionItem, Permissions } from 'shared/apis/Permissions'

export function createFetch(permission: Permissions) {
  return (resource: RequestInfo, init?: RequestInit | undefined): Promise<Response> => {
    const url = resource instanceof Request ? resource.url : resource
    if (url.toLowerCase().substr(0, 8) !== 'https://') {
      throw new Error("Can't make an unsafe request")
    }

    return permission.hasPermission(PermissionItem.USE_FETCH).then((result) => {
      if (!result) {
        throw new Error("This scene doesn't have allowed to use WebSocket")
      }
      return fetch(resource, init)
    })
  }
}
