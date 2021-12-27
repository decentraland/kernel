export type FetchFunction = (resource: RequestInfo, init?: RequestInit | undefined) => Promise<Response>

export interface FetchOptions {
  canUseFetch: boolean
  originalFetch: FetchFunction
  previewMode: boolean
  log: any
}

export function createFetch({ canUseFetch, previewMode, log, originalFetch }: FetchOptions) {
  return (resource: RequestInfo, init?: RequestInit | undefined): Promise<Response> => {
    const url = resource instanceof Request ? resource.url : resource
    if (url.toLowerCase().substr(0, 8) !== 'https://') {
      if (previewMode) {
        log("Warning: Can't make an unsafe request in deployed scenes.")
      } else {
        throw new Error("Can't make an unsafe request")
      }
    }

    if (!canUseFetch) {
      throw new Error("This scene doesn't have allowed to use fetch")
    }

    return originalFetch(resource, init)
  }
}
