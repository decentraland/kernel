import * as EthProvider from 'shared/ethereum/provider'
import * as EthService from 'shared/ethereum/EthereumService'

import { getUnityInstance } from 'unity-interface/IUnityInterface'

import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import {
  ConvertMessageToObjectRequest,
  ConvertMessageToObjectResponse,
  EthereumControllerServiceDefinition,
  GetUserAccountRequest,
  GetUserAccountResponse,
  RequirePaymentRequest,
  RequirePaymentResponse,
  SendAsyncRequest,
  SendAsyncResponse,
  SignMessageRequest,
  SignMessageResponse
} from '../proto/EthereumController.gen'
import { PortContext } from './context'
import { RPCSendableMessage } from 'shared/types'
import { PermissionItem } from '../proto/Permissions.gen'
import { assertHasPermission } from './Permissions'

async function requirePayment(req: RequirePaymentRequest, ctx): Promise<RequirePaymentResponse> {
  assertHasPermission(PermissionItem.USE_WEB3_API, ctx)

  await getUnityInstance().RequestWeb3ApiUse('requirePayment', {
    ...req,
    sceneId: ctx.EnvironmentAPI!.data.sceneId
  })

  return {
    jsonAnyResponse: JSON.stringify(EthService.requirePayment(req.toAddress, req.amount, req.currency))
  }
}

async function signMessage(req: SignMessageRequest, ctx): Promise<SignMessageResponse> {
  assertHasPermission(PermissionItem.USE_WEB3_API, ctx)

  await getUnityInstance().RequestWeb3ApiUse('signMessage', {
    message: await EthService.messageToString(req.message),
    sceneId: ctx.EnvironmentAPI!.data.sceneId
  })
  return EthService.signMessage(req.message)
}

async function convertMessageToObject(
  req: ConvertMessageToObjectRequest,
  ctx
): Promise<ConvertMessageToObjectResponse> {
  assertHasPermission(PermissionItem.USE_WEB3_API, ctx)
  return { dict: await EthService.convertMessageToObject(req.message) }
}

async function sendAsync(req: SendAsyncRequest, ctx): Promise<SendAsyncResponse> {
  const message: RPCSendableMessage = {
    jsonrpc: '2.0',
    id: req.id,
    method: req.method,
    params: JSON.parse(req.jsonParams) as any[]
  }
  assertHasPermission(PermissionItem.USE_WEB3_API, ctx)
  if (EthService.rpcRequireSign(message)) {
    await getUnityInstance().RequestWeb3ApiUse('sendAsync', {
      message: `${message.method}(${message.params.join(',')})`,
      sceneId: ctx.EnvironmentAPI!.data.sceneId
    })
  }
  return {
    jsonAnyResponse: JSON.stringify(EthService.sendAsync(message))
  }
}

async function getUserAccount(_req: GetUserAccountRequest, ctx): Promise<GetUserAccountResponse> {
  assertHasPermission(PermissionItem.USE_WEB3_API, ctx)
  return { address: await EthProvider.getUserAccount(EthProvider.requestManager) }
}

export function registerEthereumControllerServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, EthereumControllerServiceDefinition, async () => ({
    requirePayment,
    signMessage,
    convertMessageToObject,
    sendAsync,
    getUserAccount
  }))
}
