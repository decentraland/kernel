import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'
import {
  MessageDict,
  requirePayment,
  sendAsync,
  convertMessageToObject,
  signMessage
} from 'shared/ethereum/EthereumService'
import { RPCSendableMessage } from 'shared/types'
import { getUserAccount, requestManager } from 'shared/ethereum/provider'
import { RestrictedExposableAPI } from './RestrictedExposableAPI'
import { PermissionItem } from './Permissions'
import { getUnityInstance } from 'unity-interface/IUnityInterface'

export interface IEthereumController {
  /**
   * Requires a generic payment in ETH or ERC20.
   * @param  {string} [toAddress] - NFT asset id.
   * @param  {number} [amount] - Exact amount of the order.
   * @param  {string} [currency] - ETH or ERC20 supported token symbol
   */
  requirePayment(toAddress: string, amount: number, currency: string): Promise<any>

  /**
   * Takes a dictionary, converts it to string with correct format and signs it.
   * @param  {messageToSign} [MessageDict] - Message in an object format.
   * @return {object} - Promise of message and signature in an object.
   */
  signMessage(message: MessageDict): Promise<{ message: string; hexEncodedMessage: string; signature: string }>

  /**
   * Takes a message string, parses it and converts to object.
   * @param  {message} [string] - Message in a string format.
   * @return {object} - Promise of message as a MessageDict.
   * @internal
   */
  convertMessageToObject(message: string): Promise<MessageDict>

  /**
   * Used to build a Ethereum provider
   */
  sendAsync(message: RPCSendableMessage): Promise<any>

  /**
   * Gets the user's public key
   */
  getUserAccount(): Promise<string | undefined>
}

@registerAPI('EthereumController')
export class EthereumController extends RestrictedExposableAPI implements IEthereumController {
  @exposeMethod
  async requirePayment(toAddress: string, amount: number, currency: string): Promise<any> {
    await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
    await getUnityInstance().RequestWeb3ApiUse('requirePayment', { toAddress, amount, currency })
    return requirePayment(toAddress, amount, currency)
  }

  @exposeMethod
  async signMessage(message: MessageDict) {
    await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
    await getUnityInstance().RequestWeb3ApiUse('signMessage', { message })
    return signMessage(message)
  }

  @exposeMethod
  async convertMessageToObject(message: string): Promise<MessageDict> {
    await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
    return convertMessageToObject(message)
  }

  @exposeMethod
  async sendAsync(message: RPCSendableMessage): Promise<any> {
    await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
    await getUnityInstance().RequestWeb3ApiUse('sendAsync', {
      message: `${message.method}(${message.params.join(',')})`
    })
    return sendAsync(message)
  }

  @exposeMethod
  async getUserAccount(): Promise<string | undefined> {
    await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
    return getUserAccount(requestManager)
  }
}
