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

export function registerEthereumControllerServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, EthereumControllerServiceDefinition, async () => ({
    async realRequirePayment(req, ctx) {
      //   await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
      await getUnityInstance().RequestWeb3ApiUse('requirePayment', {
        ...req,
        sceneId: await ctx.EnvironmentAPI.data.sceneId
      })
      return requirePayment(req.toAddress, req.amount, req.currency)
    },
    async realSignMessage(req) {
      //   await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
      await getUnityInstance().RequestWeb3ApiUse('signMessage', {
        message: await messageToString(req.message),
        sceneId: await this.parcelIdentity.getSceneId()
      })
      return signMessage(req.message)
    },
    async realConvertMessageToObject(req) {
      //   await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
      return convertMessageToObject(req.message)
    },
    async realSendAsync(req) {
      const message = {
        jsonrpc: '2.0',
        id: req.id,
        method: req.method,
        params: JSON.parse(req.jsonParams)
      }
      //   await this.assertHasPermissions([PermissionItem.USE_WEB3_API])
      if (rpcRequireSign(message)) {
        await getUnityInstance().RequestWeb3ApiUse('sendAsync', {
          message: `${message.method}(${message.params.join(',')})`,
          sceneId: await this.parcelIdentity.getSceneId()
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
