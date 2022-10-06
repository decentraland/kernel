import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { EthereumControllerServiceDefinition } from 'shared/protocol/kernel/apis/EthereumController.gen'

export type RPCSendableMessage = {
  jsonrpc: '2.0'
  id: number
  method: string
  params: any[]
}

export interface MessageDict {
  [key: string]: string
}

export function createLegacyWeb3Provider<Context>(clientPort: RpcClientPort) {
  const originalService = codegen.loadService<Context, EthereumControllerServiceDefinition>(
    clientPort,
    EthereumControllerServiceDefinition
  )

  async function request(message: RPCSendableMessage) {
    const response = await originalService.sendAsync({
      id: message.id,
      method: message.method,
      jsonParams: JSON.stringify(message.params)
    })
    return JSON.parse(response.jsonAnyResponse)
  }

  return {
    async getProvider(): Promise<any> {
      return {
        // @internal
        send(message: RPCSendableMessage, callback?: (error: Error | null, result?: any) => void): void {
          if (message && callback && callback instanceof Function) {
            request(message)
              .then((x: any) => callback(null, x))
              .catch(callback)
          } else {
            throw new Error('Decentraland provider only allows async calls')
          }
        },
        sendAsync(message: RPCSendableMessage, callback: (error: Error | null, result?: any) => void): void {
          request(message)
            .then((x: any) => callback(null, x))
            .catch(callback)
        }
      }
    }
  }
}
