import { RootDaoState } from './types'
import {
  COMMS_SERVICE,
  FETCH_CONTENT_SERVICE,
  getServerConfigurations,
  HOTSCENES_SERVICE,
  PIN_CATALYST,
  POI_SERVICE,
  RESIZE_SERVICE,
  UPDATE_CONTENT_SERVICE
} from 'config'
import { RootMetaState } from 'shared/meta/types'
import { getContentWhitelist } from 'shared/meta/selectors'

function getAllowedContentServer(givenServer: string, meta: RootMetaState): string {
  // if a catalyst is pinned => avoid any override
  if (PIN_CATALYST) {
    return PIN_CATALYST + '/content'
  }

  const contentWhitelist = getContentWhitelist(meta)

  // if current realm is in whitelist => return current state
  if (contentWhitelist.some((allowedCandidate) => allowedCandidate === givenServer)) {
    return givenServer
  }

  if (contentWhitelist.length) {
    return contentWhitelist[0] + '/content'
  }

  return givenServer
}

export const getUpdateProfileServer = (state: RootDaoState & RootMetaState) => {
  if (UPDATE_CONTENT_SERVICE) {
    return UPDATE_CONTENT_SERVICE
  }
  return getAllowedContentServer(state.dao.updateContentServer, state)
}

export const getFetchContentServer = (state: RootDaoState & RootMetaState) => {
  if (FETCH_CONTENT_SERVICE) {
    return FETCH_CONTENT_SERVICE
  }
  return getAllowedContentServer(state.dao.fetchContentServer, state)
}

export const getCatalystServer = (store: RootDaoState) => store.dao.catalystServer
export const getResizeService = (store: RootDaoState) => {
  if (RESIZE_SERVICE) {
    return RESIZE_SERVICE
  }
  return store.dao.resizeService
}

export const getCommsServer = (store: RootDaoState) => {
  if (COMMS_SERVICE) {
    return COMMS_SERVICE
  }
  return store.dao.commsServer
}

export const getRealm = (store: RootDaoState) => store.dao.realm

export const getLayer = (store: RootDaoState) => (store.dao.realm ? store.dao.realm.layer : '')

export const getCatalystCandidates = (store: RootDaoState) => store.dao.candidates
export const getAddedCatalystCandidates = (store: RootDaoState) => store.dao.addedCandidates

export const getAllCatalystCandidates = (store: RootDaoState) =>
  getAddedCatalystCandidates(store)
    .concat(getCatalystCandidates(store))
    .filter((it) => !!it)

export const isRealmInitialized = (store: RootDaoState) => store.dao.initialized
export const areCandidatesFetched = (store: RootDaoState) => store.dao.candidatesFetched

export const getCatalystRealmCommsStatus = (store: RootDaoState) => store.dao.commsStatus

export const isResizeServiceUrl = (store: RootDaoState, url: string | undefined) =>
  url?.startsWith(getResizeService(store)) ||
  url?.startsWith(getServerConfigurations(getSelectedNetwork(store)).fallbackResizeServiceUrl)

export const getHotScenesService = (store: RootDaoState) => {
  if (HOTSCENES_SERVICE) {
    return HOTSCENES_SERVICE
  }
  return store.dao.hotScenesService
}
export const getExploreRealmsService = (store: RootDaoState) => store.dao.exploreRealmsService
export const getPOIService = (store: RootDaoState) => {
  if (POI_SERVICE) {
    return POI_SERVICE
  }
  return store.dao.poiService
}
export const getSelectedNetwork = (store: RootDaoState) => {
  if (store.dao.network) {
    return store.dao.network
  }
  throw new Error('Missing network')
}
