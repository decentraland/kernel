import PQueue from 'p-queue/dist'

const TIMEOUT_LIMIT = 29000

export type FetchFunction = typeof fetch
export interface FetchOptions {
  canUseFetch: boolean
  originalFetch: FetchFunction
  previewMode: boolean
  log(...a: any[]): void
}

export type Opts = {
  timeout: number
}

export function createFetch({ canUseFetch, previewMode, log, originalFetch }: FetchOptions) {
  const fifoFetch = new PQueue({ concurrency: 1 })
  return async (resource: RequestInfo, init?: (RequestInit & Partial<Opts>) | undefined): Promise<Response> => {
    const url = resource instanceof Request ? resource.url : resource
    if (url.toLowerCase().substr(0, 8) !== 'https://') {
      if (previewMode) {
        log(
          "⚠️ Warning: Can't make an unsafe http request in deployed scenes, please consider upgrading to https. url=" +
            url
        )
      } else {
        return Promise.reject(new Error("Can't make an unsafe http request, please upgrade to https. url=" + url))
      }
    }

    if (!canUseFetch) {
      return Promise.reject(new Error('This scene is not allowed to use fetch.'))
    }

    return fifoFetch.add(() => fetchWithTimeout(originalFetch, resource, init))
  }
}

export async function fetchWithTimeout(
  fetch: FetchFunction,
  resource: RequestInfo,
  init?: RequestInit & Partial<Opts>
) {
  const abortController = new AbortController()
  const timeout = setTimeout(() => {
    abortController.abort()
  }, init?.timeout || TIMEOUT_LIMIT)
  const response = await fetch(resource, { signal: abortController.signal, ...init })
  clearTimeout(timeout)
  return response
}
