import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'
import {
  MessageDict,
  requirePayment,
  sendAsync,
  convertMessageToObject,
  signMessage
} from 'shared/ethereum/EthereumService'
import { ExposableAPI } from './ExposableAPI'
import { RPCSendableMessage } from 'shared/types'
import { getUserAccount, requestManager } from 'shared/ethereum/provider'
import { PermissionItem, Permissions } from './Permissions'

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
export class EthereumController extends ExposableAPI implements IEthereumController {
  @exposeMethod
  async requirePayment(toAddress: string, amount: number, currency: string): Promise<any> {
    await this.ensureHasPermissions()
    return requirePayment(toAddress, amount, currency)
  }

  @exposeMethod
  async signMessage(message: MessageDict) {
    await this.ensureHasPermissions()
    return signMessage(message)
  }

  @exposeMethod
  async convertMessageToObject(message: string): Promise<MessageDict> {
    await this.ensureHasPermissions()
    return convertMessageToObject(message)
  }

  @exposeMethod
  async sendAsync(message: RPCSendableMessage): Promise<any> {
    await this.ensureHasPermissions()
    return sendAsync(message)
  }

  @exposeMethod
  async getUserAccount(): Promise<string | undefined> {
    await this.ensureHasPermissions()
    return getUserAccount(requestManager)
  }

  private async ensureHasPermissions() {
    const permissions: Permissions = this.options.getAPIInstance(Permissions)
    if (!(await permissions.hasPermission(PermissionItem.USE_WEB3_API))) {
      throw new Error("This scene doesn't have permission to use web3 api")
    }
  }
}
