import { ETHEREUM_NETWORK } from 'config'
import { AnyAction } from 'redux'
import {
  SET_CATALYST_REALM,
  SET_CATALYST_CANDIDATES,
  SET_CATALYST_REALM_COMMS_STATUS,
  SET_ADDED_CATALYST_CANDIDATES,
  SELECT_NETWORK,
  SelectNetworkAction
} from './actions'
import { DaoState, Realm } from './types'

export function daoReducer(state?: DaoState, action?: AnyAction): DaoState {
  if (!state) {
    return {
      network: null,
      initialized: false,
      candidatesFetched: false,
      fetchContentServer: '',
      catalystServer: '',
      updateContentServer: '',
      commsServer: '',
      resizeService: '',
      hotScenesService: '',
      exploreRealmsService: '',
      poiService: '',
      realm: undefined,
      candidates: [],
      addedCandidates: [],
      commsStatus: { status: 'initial', connectedPeers: 0 }
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
        candidatesFetched: true,
        candidates: action.payload
      }
    case SET_ADDED_CATALYST_CANDIDATES:
      return {
        ...state,
        addedCandidates: action.payload
      }
    case SET_CATALYST_REALM:
      return {
        ...state,
        ...realmProperties(action.payload, state.network),
        initialized: true
      }
    case SET_CATALYST_REALM_COMMS_STATUS:
      return {
        ...state,
        commsStatus: action.payload ? action.payload : { status: 'initial', connectedPeers: 0 }
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
      commsServer: domain + '/comms',
      resizeService: domain + '/lambdas/images',
      hotScenesService: domain + '/lambdas/explore/hot-scenes',
      poiService: domain + '/lambdas/contracts/pois',
      exploreRealmsService: domain + '/lambdas/explore/realms',
      realm
    }
  }

  // this condition exists until the BFF is finished and the "services" become interfaces
  if (realm.protocol == 'v1' || realm.protocol == 'v2') {
    return lighthouseBasedPartial(domain)
  } else if (network == ETHEREUM_NETWORK.ROPSTEN) {
    return lighthouseBasedPartial('https://peer.decentraland.zone')
  } else {
    return lighthouseBasedPartial('https://peer.decentraland.org')
  }
}
