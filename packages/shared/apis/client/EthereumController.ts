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

export namespace EthereumControllerServiceClient {
  export function create<Context>(clientPort: RpcClientPort) {
    return codegen.loadService<Context, EthereumControllerServiceDefinition>(
      clientPort,
      EthereumControllerServiceDefinition
    )
  }

  export function createLegacy<Context>(clientPort: RpcClientPort) {
    const originalService = codegen.loadService<Context, EthereumControllerServiceDefinition>(
      clientPort,
      EthereumControllerServiceDefinition
    )

    return {
      ...originalService,

      /**
       * Requires a generic payment in ETH or ERC20.
       * @param  {string} [toAddress] - NFT asset id.
       * @param  {number} [amount] - Exact amount of the order.
       * @param  {string} [currency] - ETH or ERC20 supported token symbol
       */
      async requirePayment(toAddress: string, amount: number, currency: string): Promise<any> {
        const response = await originalService.requirePayment({ toAddress, amount, currency })
        return JSON.parse(response.jsonAnyResponse)
      },

      /**
       * Takes a dictionary, converts it to string with correct format and signs it.
       * @param  {messageToSign} [MessageDict] - Message in an object format.
       * @return {object} - Promise of message and signature in an object.
       */
      async signMessage(
        message: MessageDict
      ): Promise<{ message: string; hexEncodedMessage: string; signature: string }> {
        return await originalService.signMessage({ message })
      },

      /**
       * Takes a message string, parses it and converts to object.
       * @param  {message} [string] - Message in a string format.
       * @return {object} - Promise of message as a MessageDict.
       * @internal
       */
      async convertMessageToObject(message: string): Promise<MessageDict> {
        return (await originalService.convertMessageToObject({ message })).dict
      },

      /**
       * Used to build a Ethereum provider
       */
      async sendAsync(message: RPCSendableMessage): Promise<any> {
        return JSON.parse(
          (
            await originalService.sendAsync({
              id: message.id,
              method: message.method,
              jsonParams: JSON.stringify(message.params)
            })
          ).jsonAnyResponse
        )
      },

      /**
       * Returns the user's public key (address)
       */
      async getUserAccount(): Promise<string> {
        return (await originalService.getUserAccount({})).address!
      }
    }
  }
}
