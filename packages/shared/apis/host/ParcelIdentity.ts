import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import {
  GetParcelRequest,
  GetParcelResponse,
  GetSceneIdRequest,
  ParcelIdentityServiceDefinition,
  GetIsEmptyResponse,
  GetIsEmptyRequest,
  GetSceneIdResponse
} from '../proto/ParcelIdentity'
import { PortContext } from './context'

async function getParcel(_req: GetParcelRequest, ctx: PortContext): Promise<GetParcelResponse> {
  const land = ctx.ParcelIdentity.land

  if (!land) {
    throw new Error('No land assigned in the ParcelIdentity context.')
  }

  return {
    land: {
      sceneId: land.sceneId,
      sceneJsonData: JSON.stringify(land.sceneJsonData),
      baseUrl: land.baseUrl,
      baseUrlBundles: land.baseUrlBundles || '',
      mappingsResponse: {
        parcelId: land.mappingsResponse.parcel_id,
        rootCid: land.mappingsResponse.root_cid,
        contents: land.mappingsResponse.contents
      }
    },
    cid: ctx.EnvironmentAPI.cid
  }
}

async function getSceneId(_req: GetSceneIdRequest, ctx: PortContext): Promise<GetSceneIdResponse> {
  const sceneId = ctx.ParcelIdentity.land?.sceneId || ctx.EnvironmentAPI.cid || ''
  return { sceneId }
}

async function getIsEmpty(_req: GetIsEmptyRequest, ctx: PortContext): Promise<GetIsEmptyResponse> {
  return { isEmpty: ctx.ParcelIdentity.isEmpty }
}

export function registerParcelIdentityServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, ParcelIdentityServiceDefinition, async () => ({
    getParcel,
    getSceneId,
    getIsEmpty
  }))
}
