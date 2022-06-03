import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { SignedFetchServiceDefinition, FlatFetchInit } from '../gen/SignedFetch'

export type OriginalFlatFetchResponse = {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  json?: any
  text?: string
}

export type BodyType = 'json' | 'text'

export type OriginalFlatFetchInit = RequestInit & { responseBodyType?: BodyType }

export async function createSignedFetchServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = await codegen.loadService<Context, SignedFetchServiceDefinition>(
    clientPort,
    SignedFetchServiceDefinition
  )

  return {
    ...originalService,
    async signedFetch(url: string, originalInit?: OriginalFlatFetchInit): Promise<OriginalFlatFetchResponse> {
      let init: FlatFetchInit | undefined = undefined
      if (originalInit) {
        init = { headers: {} }
        if (originalInit.headers && typeof originalInit.headers === 'object') {
          init.headers = originalInit.headers as Record<string, string>
        }
        if (originalInit.body && typeof originalInit.body === 'string') {
          init.body = originalInit.body
        }
        if (originalInit.method && typeof originalInit.method === 'string') {
          init.method = originalInit.method
        }
      }
      const result = await originalService.signedFetch({ url, init })
      return {
        ok: result.ok,
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        json: originalInit?.responseBodyType === 'json' ? JSON.parse(result.body) : undefined,
        text: originalInit?.responseBodyType === 'text' ? result.body : undefined
      }
    }
  }
}
