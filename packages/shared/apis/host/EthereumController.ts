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
import { PermissionItem } from '../gen/Permissions'
import { assertHasPermission } from './Permissions'

export function registerEthereumControllerServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, EthereumControllerServiceDefinition, async () => ({
    async requirePayment(req, ctx) {
      assertHasPermission(PermissionItem.USE_WEB3_API, ctx)

      await getUnityInstance().RequestWeb3ApiUse('requirePayment', {
        ...req,
        sceneId: ctx.EnvironmentAPI!.data.sceneId
      })
      return requirePayment(req.toAddress, req.amount, req.currency)
    },
    async signMessage(req, ctx) {
      assertHasPermission(PermissionItem.USE_WEB3_API, ctx)

      await getUnityInstance().RequestWeb3ApiUse('signMessage', {
        message: await messageToString(req.message),
        sceneId: ctx.EnvironmentAPI!.data.sceneId
      })
      return signMessage(req.message)
    },
    async convertMessageToObject(req, ctx) {
      assertHasPermission(PermissionItem.USE_WEB3_API, ctx)
      return { dict: await convertMessageToObject(req.message) }
    },
    async sendAsync(req, ctx) {
      const message: RPCSendableMessage = {
        jsonrpc: '2.0',
        id: req.id,
        method: req.method,
        params: JSON.parse(req.jsonParams) as any[]
      }
      assertHasPermission(PermissionItem.USE_WEB3_API, ctx)
      if (rpcRequireSign(message)) {
        await getUnityInstance().RequestWeb3ApiUse('sendAsync', {
          message: `${message.method}(${message.params.join(',')})`,
          sceneId: ctx.EnvironmentAPI!.data.sceneId
        })
      }
      return sendAsync(message)
    },
    async getUserAccount(_req, ctx) {
      assertHasPermission(PermissionItem.USE_WEB3_API, ctx)
      return { address: await getUserAccount(requestManager) }
    }
  }))
}
