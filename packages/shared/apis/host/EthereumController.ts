import {
  requirePayment,
  sendAsync,
  convertMessageToObject,
  signMessage,
  messageToString,
  rpcRequireSign
} from 'shared/ethereum/EthereumService'
import { getUserAccount, requestManager } from 'shared/ethereum/provider'
import { getUnityInstance } from 'unity-interface/IUnityInterface'

import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { EthereumControllerServiceDefinition } from '../gen/EthereumController'
import { PortContext } from './context'
import { RPCSendableMessage } from 'shared/types'

export function registerEthereumControllerServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, EthereumControllerServiceDefinition, async () => ({
    async realRequirePayment(req, ctx) {
      //   await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
      await getUnityInstance().RequestWeb3ApiUse('requirePayment', {
        ...req,
        sceneId: ctx.EnvironmentAPI!.data.sceneId
      })
      return requirePayment(req.toAddress, req.amount, req.currency)
    },
    async realSignMessage(req, ctx) {
      //   await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
      await getUnityInstance().RequestWeb3ApiUse('signMessage', {
        message: await messageToString(req.message),
        sceneId: ctx.EnvironmentAPI!.data.sceneId
      })
      return signMessage(req.message)
    },
    async realConvertMessageToObject(req) {
      //   await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
      return { dict: await convertMessageToObject(req.message) }
    },
    async realSendAsync(req, ctx) {
      const message: RPCSendableMessage = {
        jsonrpc: '2.0',
        id: req.id,
        method: req.method,
        params: JSON.parse(req.jsonParams) as any[]
      }
      //   await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
      if (rpcRequireSign(message)) {
        await getUnityInstance().RequestWeb3ApiUse('sendAsync', {
          message: `${message.method}(${message.params.join(',')})`,
          sceneId: ctx.EnvironmentAPI!.data.sceneId
        })
      }
      return sendAsync(message)
    },
    async realGetUserAccount() {
      //   await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
      return { address: await getUserAccount(requestManager) }
    }
  }))
}
