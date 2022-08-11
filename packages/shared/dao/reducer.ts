import { ETHEREUM_NETWORK } from 'config'
import { AnyAction } from 'redux'
import { SetWorldContextAction, SET_WORLD_CONTEXT } from 'shared/comms/actions'
import { SET_CATALYST_CANDIDATES, SELECT_NETWORK, SelectNetworkAction } from './actions'
import { DaoState, Realm } from './types'

export function daoReducer(state?: DaoState, action?: AnyAction): DaoState {
  if (!state) {
    return {
      network: null,
      fetchContentServer: '',
      catalystServer: '',
      updateContentServer: '',
      resizeService: '',
      hotScenesService: '',
      exploreRealmsService: '',
      poiService: '',
      candidates: [],
      catalystCandidatesReceived: false
    }
  }
  if (!action) {
    return state
  }
  switch (action.type) {
    case SELECT_NETWORK:
      return {
        ...state,
        network: (action as SelectNetworkAction).payload
      }
    case SET_CATALYST_CANDIDATES:
      return {
        ...state,
        catalystCandidatesReceived: true,
        candidates: action.payload
      }
    case SET_WORLD_CONTEXT:
      const context = (action as SetWorldContextAction).payload
      if (!context) return state
      return {
        ...state,
        ...realmProperties(context.realm, state.network)
      }
  }
  return state
}

function realmProperties(realm: Realm, network: ETHEREUM_NETWORK | null): Partial<DaoState> {
  const domain = realm.hostname

  function lighthouseBasedPartial(domain: string) {
    return {
      fetchContentServer: domain + '/content',
      catalystServer: domain,
      updateContentServer: domain + '/content',
      resizeService: domain + '/lambdas/images',
      hotScenesService: domain + '/lambdas/explore/hot-scenes',
      poiService: domain + '/lambdas/contracts/pois',
      exploreRealmsService: domain + '/lambdas/explore/realms',
      realm
    }
  }

  // this condition exists until the BFF is finished and the "services" become interfaces
  if (realm.protocol === 'v1' || realm.protocol === 'v2' || realm.protocol === 'v3') {
    return lighthouseBasedPartial(domain)
  } else if (network === ETHEREUM_NETWORK.GOERLI) {
    return lighthouseBasedPartial('https://peer-ap1.decentraland.zone')
  } else {
    return lighthouseBasedPartial('https://peer.decentraland.org')
  }
}
