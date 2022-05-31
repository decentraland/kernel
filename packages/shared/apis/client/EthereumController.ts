import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { EthereumControllerServiceDefinition } from '../gen/EthereumController'

export type RPCSendableMessage = {
  jsonrpc: '2.0'
  id: number
  method: string
  params: any[]
}

export interface MessageDict {
  [key: string]: string
}

export async function createEthereumControllerServiceClient<Context>(clientPort: RpcClientPort) {
  const realService = await codegen.loadService<Context, EthereumControllerServiceDefinition>(
    clientPort,
    EthereumControllerServiceDefinition
  )

  return {
    ...realService,

    /**
     * Requires a generic payment in ETH or ERC20.
     * @param  {string} [toAddress] - NFT asset id.
     * @param  {number} [amount] - Exact amount of the order.
     * @param  {string} [currency] - ETH or ERC20 supported token symbol
     */
    async requirePayment(toAddress: string, amount: number, currency: string): Promise<any> {
      return await realService.realRequirePayment({ toAddress, amount, currency })
    },

    /**
     * Takes a dictionary, converts it to string with correct format and signs it.
     * @param  {messageToSign} [MessageDict] - Message in an object format.
     * @return {object} - Promise of message and signature in an object.
     */
    async signMessage(
      message: MessageDict
    ): Promise<{ message: string; hexEncodedMessage: string; signature: string }> {
      return await realService.realSignMessage({ message })
    },

    /**
     * Takes a message string, parses it and converts to object.
     * @param  {message} [string] - Message in a string format.
     * @return {object} - Promise of message as a MessageDict.
     * @internal
     */
    async convertMessageToObject(message: string): Promise<MessageDict> {
      return (await realService.realConvertMessageToObject({ message })).dict
    },

    /**
     * Used to build a Ethereum provider
     */
    async sendAsync(message: RPCSendableMessage): Promise<any> {
      return JSON.parse(
        (
          await realService.realSendAsync({
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
      return (await realService.realGetUserAccount({})).address!
    }
  }
}
