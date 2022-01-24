import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'
import { ExposableAPI } from './ExposableAPI'
import { ILand } from 'shared/types'

export interface IParcelIdentity {
  getParcel(): Promise<{ land: ILand; cid: string }>
}

@registerAPI('ParcelIdentity')
export class ParcelIdentity extends ExposableAPI implements IParcelIdentity {
  land!: ILand
  cid!: string
  isPortableExperience: boolean = false
  isEmpty: boolean = false

  /**
   * Returns the coordinates and the definition of a parcel
   */
  @exposeMethod
  async getParcel(): Promise<{ land: ILand; cid: string }> {
    return {
      land: this.land,
      cid: this.cid
    }
  }

  /**
   * Returns if the parcel is empty or not
   */
  @exposeMethod
  async getIsEmpty(): Promise<boolean> {
    return this.isEmpty
  }

  /**
   * Returns the scene id
   */
  @exposeMethod
  async getSceneId(): Promise<string> {
    return this.land?.sceneId || this.cid || ''
  }
}
