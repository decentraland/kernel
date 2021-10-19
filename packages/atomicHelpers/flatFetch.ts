export type FlatFetchResponse = {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  json?: any
  text?: string
}

export type BodyType = 'json' | 'text'

export type FlatFetchInit = RequestInit & { responseBodyType?: BodyType }

export type SignedFetchInit = FlatFetchInit & {
  /** Overrides path in signature. To use when the requested service is behind a reverse proxy or something similar,
   *  and the exposed path doesn't correspond with the server's internal path for the request */
  pathToSignOverride?: string
}

export async function flatFetch(url: string, init?: FlatFetchInit): Promise<FlatFetchResponse> {
  const response = await fetch(url, init)

  const responseBodyType = init?.responseBodyType || 'text'

  const headers: Record<string, string> = {}

  response.headers.forEach((value, key) => (headers[key] = value))

  const flatFetchResponse: FlatFetchResponse = {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers
  }

  switch (responseBodyType) {
    case 'json':
      flatFetchResponse.json = await response.json()
      break
    case 'text':
      flatFetchResponse.text = await response.text()
      break
  }

  return flatFetchResponse
}
