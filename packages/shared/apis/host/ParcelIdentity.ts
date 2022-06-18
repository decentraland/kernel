import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { ETHEREUM_NETWORK } from 'config'
import {
  GetParcelRequest,
  GetParcelResponse,
  GetSceneIdRequest,
  ParcelIdentityServiceDefinition,
  GetIsEmptyResponse,
  GetIsEmptyRequest,
  GetSceneIdResponse
} from '../proto/ParcelIdentity.gen'
import { PortContext } from './context'

async function getParcel(_req: GetParcelRequest, ctx: PortContext): Promise<GetParcelResponse> {
  const land = ctx.ParcelIdentity.entity

  if (!land) {
    throw new Error('No land assigned in the ParcelIdentity context.')
  }

  return {
    land: {
      sceneId: land.id || '',
      sceneJsonData: land.metadata ? JSON.stringify(land.metadata) : '{}',
      baseUrl: land.baseUrl || '',
      baseUrlBundles: getAssetBundlesBaseUrl(ETHEREUM_NETWORK.MAINNET) + '/',
      mappingsResponse: {
        parcelId: land.id || '',
        rootCid: land.id || '',
        contents: (land.content || []).map((item) => ({
          file: item.file || '',
          hash: item.hash || ''
        }))
      }
    },
    cid: ctx.EnvironmentAPI.cid || ''
  }
}

async function getSceneId(_req: GetSceneIdRequest, ctx: PortContext): Promise<GetSceneIdResponse> {
  const sceneId = ctx.ParcelIdentity.entity.id || ctx.EnvironmentAPI.cid || ''
  return { sceneId }
}

async function getIsEmpty(_req: GetIsEmptyRequest, ctx: PortContext): Promise<GetIsEmptyResponse> {
  return { isEmpty: false }
}

export function registerParcelIdentityServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, ParcelIdentityServiceDefinition, async () => ({
    getParcel,
    getSceneId,
    getIsEmpty
  }))
}
function getAssetBundlesBaseUrl(MAINNET: any) {
  throw new Error('Function not implemented.')
}

