import PQueue from 'p-queue/dist'

export type FetchFunction = typeof fetch
export interface FetchOptions {
  canUseFetch: boolean
  originalFetch: FetchFunction
  previewMode: boolean
  log(...a: any[]): void
}

type Opts = {
  timeout?: number
}

export function createFetch({ canUseFetch, previewMode, log, originalFetch }: FetchOptions) {
  const fifoFetch = new PQueue({ concurrency: 1 })
  return (resource: RequestInfo, init?: RequestInit | undefined, opts?: Opts): Promise<Response> => {
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

    async function fetchRequest() {
      const abortController = new AbortController()
      const TIMEOUT_LIMIT = 30000
      const timeout = setTimeout(() => {
        abortController.abort()
      }, opts?.timeout || TIMEOUT_LIMIT)
      const response = await originalFetch(resource, { signal: abortController.signal, ...init })
      clearTimeout(timeout)
      return response
    }

    return fifoFetch.add(fetchRequest)
  }
}
