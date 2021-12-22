import { PermissionItem, Permissions } from 'shared/apis/Permissions'

export type FetchFunction = (resource: RequestInfo, init?: RequestInit | undefined) => Promise<Response>

export function createFetch(permission: Permissions, originalFetch: FetchFunction) {
  return (resource: RequestInfo, init?: RequestInit | undefined): Promise<Response> => {
    const url = resource instanceof Request ? resource.url : resource
    if (url.toLowerCase().substr(0, 8) !== 'https://') {
      throw new Error("Can't make an unsafe request")
    }

    return permission.hasPermission(PermissionItem.USE_FETCH).then((result) => {
      if (!result) {
        throw new Error("This scene doesn't have allowed to use fetch")
      }
      return originalFetch(resource, init)
    })
  }
}
