import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { SignedFetchServiceDefinition, FlatFetchInit } from 'shared/protocol/kernel/apis/SignedFetch.gen'

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

export namespace SignedFetchServiceClient {
  export function create<Context>(clientPort: RpcClientPort) {
    return codegen.loadService<Context, SignedFetchServiceDefinition>(clientPort, SignedFetchServiceDefinition)
  }

  export function createLegacy<Context>(clientPort: RpcClientPort) {
    const originalService = codegen.loadService<Context, SignedFetchServiceDefinition>(
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
        const responseBodyType = originalInit?.responseBodyType || 'text'
        const result = await originalService.signedFetch({ url, init })

        return {
          ok: result.ok,
          status: result.status,
          statusText: result.statusText,
          headers: result.headers,
          json: responseBodyType === 'json' ? JSON.parse(result.body) : undefined,
          text: responseBodyType === 'text' ? result.body : undefined
        }
      }
    }
  }
}
