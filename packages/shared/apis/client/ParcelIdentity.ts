import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { ParcelIdentityServiceDefinition } from '../gen/ParcelIdentity'
import { ILand } from '../../types'

export async function createParcelIdentityServiceClient<Context>(clientPort: RpcClientPort) {
  const realService = await codegen.loadService<Context, ParcelIdentityServiceDefinition>(
    clientPort,
    ParcelIdentityServiceDefinition
  )

  return {
    ...realService,

    /**
     * Returns the coordinates and the definition of a parcel
     */
    async getParcel(): Promise<{ land: ILand; cid: string }> {
      const data = await realService.realGetParcel({})
      return {
        land: data.land as any as ILand,
        cid: data.cid
      }
    },

    /**
     * Returns if the parcel is empty or not
     */
    async getIsEmpty(): Promise<boolean> {
      const data = await realService.realGetIsEmpty({})
      return data.isEmpty
    },

    /**
     * Returns the scene id
     */
    async getSceneId(): Promise<string> {
      const data = await realService.realGetSceneId({})
      return data.sceneId
    }
  }
}
