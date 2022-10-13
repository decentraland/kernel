import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { ParcelIdentityServiceDefinition } from 'shared/protocol/kernel/apis/ParcelIdentity.gen'
import { ILand } from '../../types'

export namespace ParcelIdentityServiceClient {
  export function create<Context>(clientPort: RpcClientPort) {
    return codegen.loadService<Context, ParcelIdentityServiceDefinition>(clientPort, ParcelIdentityServiceDefinition)
  }

  export function createLegacy<Context>(clientPort: RpcClientPort) {
    const originalService = codegen.loadService<Context, ParcelIdentityServiceDefinition>(
      clientPort,
      ParcelIdentityServiceDefinition
    )

    return {
      ...originalService,

      /**
       * Returns the coordinates and the definition of a parcel
       */
      async getParcel(): Promise<{ land: ILand; cid: string }> {
        const data = await originalService.getParcel({})
        return {
          land: {
            sceneId: data.land?.sceneId || '',
            sceneJsonData: JSON.parse(data.land?.sceneJsonData || '{}'),
            baseUrl: data.land?.baseUrl || '',
            baseUrlBundles: data.land?.baseUrlBundles || '',
            mappingsResponse: {
              root_cid: data.land?.mappingsResponse?.rootCid || '',
              parcel_id: data.land?.mappingsResponse?.parcelId || '',
              contents: data.land?.mappingsResponse?.contents || []
            }
          },
          cid: data.cid
        }
      },

      /**
       * Returns the scene id
       */
      async getSceneId(): Promise<string> {
        const data = await originalService.getSceneId({})
        return data.sceneId
      }
    }
  }
}
