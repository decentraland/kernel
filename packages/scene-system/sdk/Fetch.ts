import PQueue from 'p-queue/dist'

export type FetchFunction = typeof fetch
export type WaitForNextUpdateFunction = () => Promise<unknown>
export interface FetchOptions {
  canUseFetch: boolean
  originalFetch: FetchFunction
  previewMode: boolean
  log(...a: any[]): void
}

export function createFetch({ canUseFetch, previewMode, log, originalFetch }: FetchOptions) {
  const fifoFetch = new PQueue({ concurrency: 1 })
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

    return fifoFetch.add(() => originalFetch(resource, init))
  }
}
