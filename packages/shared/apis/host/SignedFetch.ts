// import { ExposableAPI } from './ExposableAPI'
// import { exposeMethod, registerAPI } from 'decentraland-rpc/lib/host'
// import { ParcelIdentity } from './ParcelIdentity'
// import { FlatFetchInit, FlatFetchResponse } from 'atomicHelpers/flatFetch'
// import { signedFetch } from 'atomicHelpers/signedFetch'
// import { ETHEREUM_NETWORK } from '../../config'
// import { getSelectedNetwork } from 'shared/dao/selectors'
// import { store } from 'shared/store/isolatedStore'
// import { getIsGuestLogin } from 'shared/session/selectors'
// import { onLoginCompleted } from 'shared/session/sagas'
// import { getRealm } from 'shared/comms/selectors'

// @registerAPI('SignedFetch')
// export class SignedFetch extends ExposableAPI {
//   parcelIdentity = this.options.getAPIInstance(ParcelIdentity)

//   @exposeMethod
//   async signedFetch(url: string, init?: FlatFetchInit): Promise<FlatFetchResponse> {
//     const { identity } = await onLoginCompleted()

//     const state = store.getState()
//     const realm = getRealm(state)
//     const isGuest = !!getIsGuestLogin(state)
//     const network = getSelectedNetwork(state)

//     const compatibilityRealm:
//       | {
//           domain: string
//           layer: string
//           catalystName: string
//         }
//       | undefined = realm ? { domain: realm.hostname, layer: '', catalystName: realm.serverName } : undefined

//     const additionalMetadata: Record<string, any> = {
//       sceneId: this.parcelIdentity.cid,
//       parcel: this.getSceneData().scene.base,
//       // THIS WILL BE DEPRECATED
//       tld: network === ETHEREUM_NETWORK.MAINNET ? 'org' : 'zone',
//       network,
//       isGuest,
//       realm: realm?.protocol === 'v2' || realm?.protocol === 'v1' ? compatibilityRealm : realm,
//       signer: 'decentraland-kernel-scene'
//     }

//     return signedFetch(url, identity!, init, additionalMetadata)
//   }

//   private getSceneData() {
//     return this.parcelIdentity.land.sceneJsonData
//   }
// }
