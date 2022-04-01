import { AnyAction } from 'redux'
import {
  SET_CATALYST_REALM,
  SET_CATALYST_CANDIDATES,
  SET_CATALYST_REALM_COMMS_STATUS,
  MARK_CATALYST_REALM_FULL,
  SET_ADDED_CATALYST_CANDIDATES,
  MARK_CATALYST_REALM_CONNECTION_ERROR,
  SELECT_NETWORK,
  SelectNetworkAction
} from './actions'
import { DaoState, Realm, ServerConnectionStatus } from './types'

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
        ...realmProperties(action.payload),
        initialized: true
      }
    case SET_CATALYST_REALM_COMMS_STATUS:
      return {
        ...state,
        commsStatus: action.payload ? action.payload : { status: 'initial', connectedPeers: 0 }
      }
    case MARK_CATALYST_REALM_FULL:
      return {
        ...state,
        candidates: state.candidates.map((it) => {
          return it
        })
      }
    case MARK_CATALYST_REALM_CONNECTION_ERROR:
      return {
        ...state,
        candidates: state.candidates.map((it) => {
          if (it && it.catalystName === action.payload.catalystName) {
            return {
              ...it,
              status: ServerConnectionStatus.UNREACHABLE,
              elapsed: Number.MAX_SAFE_INTEGER
            }
          } else {
            return it
          }
        })
      }
  }
  return state
}

function realmProperties(realm: Realm): Partial<DaoState> {
  const domain = realm.domain
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
