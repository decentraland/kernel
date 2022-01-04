export type FetchFunction = typeof fetch
export type WaitForNextUpdateFunction = () => Promise<unknown>
export interface FetchOptions {
  canUseFetch: boolean
  originalFetch: FetchFunction
  previewMode: boolean
  log(...a: any[]): void
}

export function createConcurrentFetch(originalFetch: FetchFunction, waitForNextUpdate: WaitForNextUpdateFunction) {
  const fifoFetch: string[] = []
  return async (resource: RequestInfo, init?: RequestInit | undefined): Promise<Response> => {
    const hash = Math.random().toString()
    fifoFetch.push(hash)

    const resolving = () => fifoFetch.length > 0 && fifoFetch[0] !== hash

    await waitForNextUpdate()

    while (fifoFetch.length > 0 && fifoFetch[0] !== hash) {
      await waitForNextUpdate()
    }

    if (fifoFetch.length === 0) {
      throw new Error('Inconsistency fifo fetch')
    }

    try {
      const result = await originalFetch(resource, init)

      void waitForNextUpdate().then(() => {
        if (resolving()) {
          fifoFetch.shift()
        }
      })

      return {
        ...result,
        json: async () => {
          const json = await result.json()
          fifoFetch.shift()
          return json
        },
        text: async () => {
          const text = await result.text()
          fifoFetch.shift()
          return text
        }
      }
    } catch (err) {
      fifoFetch.shift()
      throw err
    }
  }
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
