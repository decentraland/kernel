import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { ParcelIdentityServiceDefinition } from '../proto/ParcelIdentity.gen'
import { ILand } from '../../types'

export function createParcelIdentityServiceClient<Context>(clientPort: RpcClientPort) {
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
        land: data.land as any as ILand,
        cid: data.cid
      }
    },

    /**
     * Returns if the parcel is empty or not
     */
    async getIsEmpty(): Promise<boolean> {
      const data = await originalService.getIsEmpty({})
      return data.isEmpty
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
