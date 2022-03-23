import { ExposableAPI } from './ExposableAPI'
import { exposeMethod, registerAPI } from 'decentraland-rpc/lib/host'
import { ParcelIdentity } from './ParcelIdentity'
import { FlatFetchInit, FlatFetchResponse } from 'atomicHelpers/flatFetch'
import { signedFetch } from 'atomicHelpers/signedFetch'
import { ETHEREUM_NETWORK } from '../../config'
import { getRealm, getSelectedNetwork } from 'shared/dao/selectors'
import { store } from 'shared/store/isolatedStore'
import { getIsGuestLogin } from 'shared/session/selectors'
import { onLoginCompleted } from 'shared/session/sagas'
@registerAPI('SignedFetch')
export class SignedFetch extends ExposableAPI {
  parcelIdentity = this.options.getAPIInstance(ParcelIdentity)

  @exposeMethod
  async signedFetch(url: string, init?: FlatFetchInit): Promise<FlatFetchResponse> {
    const { identity } = await onLoginCompleted()

    const state = store.getState()
    const realm = getRealm(state)
    const isGuest = !!getIsGuestLogin(state)
    const network = getSelectedNetwork(state)

    const additionalMetadata: Record<string, any> = {
      sceneId: this.parcelIdentity.cid,
      parcel: this.getSceneData().scene.base,
      // THIS WILL BE DEPRECATED
      tld: network === ETHEREUM_NETWORK.MAINNET ? 'org' : 'zone',
      network,
      isGuest,
      realm: realm ? { ...realm, layer: '' } : undefined // If the realm doesn't have layer, we send it
    }

    return signedFetch(url, identity!, init, additionalMetadata)
  }

  private getSceneData() {
    return this.parcelIdentity.land.sceneJsonData
  }
}
