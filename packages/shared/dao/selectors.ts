import { RootDaoState } from './types'
import {
  COMMS_SERVICE,
  FETCH_CONTENT_SERVICE,
  HOTSCENES_SERVICE,
  PIN_CATALYST,
  POI_SERVICE,
  UPDATE_CONTENT_SERVICE
} from 'config'
import { RootMetaState } from 'shared/meta/types'
import { getContentWhitelist } from 'shared/meta/selectors'
import { urlWithProtocol } from 'shared/bff/resolver'
import { RootBffState } from 'shared/bff/types'

function getAllowedContentServer(givenServer: string, meta: RootMetaState): string {
  // if a catalyst is pinned => avoid any override
  if (PIN_CATALYST) {
    return urlWithProtocol(PIN_CATALYST + '/content')
  }

  const contentWhitelist = getContentWhitelist(meta)

  // if current realm is in whitelist => return current state
  if (contentWhitelist.some((allowedCandidate) => allowedCandidate === givenServer)) {
    return urlWithProtocol(givenServer)
  }

  if (contentWhitelist.length) {
    return urlWithProtocol(contentWhitelist[0] + '/content')
  }

  return urlWithProtocol(givenServer)
}

export const getUpdateProfileServer = (state: RootBffState & RootMetaState) => {
  if (UPDATE_CONTENT_SERVICE) {
    return urlWithProtocol(UPDATE_CONTENT_SERVICE)
  }
  // if a catalyst is pinned => avoid any override
  if (PIN_CATALYST) {
    return urlWithProtocol(PIN_CATALYST + '/content')
  }
  return urlWithProtocol(state.bff.bff!.services.legacy.updateContentServer)
}

export const getFetchContentServer = (state: RootBffState & RootMetaState) => {
  if (FETCH_CONTENT_SERVICE) {
    return urlWithProtocol(FETCH_CONTENT_SERVICE)
  }
  return getAllowedContentServer(state.bff.bff!.services.legacy.fetchContentServer, state)
}

export const getCatalystServer = (state: RootBffState) => urlWithProtocol(state.bff.bff!.services.legacy.catalystServer)

export const getCommsServer = (domain: string) => {
  if (COMMS_SERVICE) {
    return urlWithProtocol(COMMS_SERVICE)
  }

  return urlWithProtocol(domain + '/comms')
}

export const getCatalystCandidates = (store: RootDaoState) => store.dao.candidates
export const getCatalystCandidatesReceived = (store: RootDaoState) => store.dao.catalystCandidatesReceived

export const getAllCatalystCandidates = (store: RootDaoState) => getCatalystCandidates(store).filter((it) => !!it)

export const getHotScenesService = (state: RootBffState) => {
  if (HOTSCENES_SERVICE) {
    return HOTSCENES_SERVICE
  }
  return urlWithProtocol(state.bff.bff!.services.legacy.hotScenesService)
}

export const getExploreRealmsService = (state: RootBffState) => state.bff.bff!.services.legacy.exploreRealmsService
export const getPOIService = (state: RootBffState) => {
  if (POI_SERVICE) {
    return POI_SERVICE
  }
  return urlWithProtocol(state.bff.bff!.services.legacy.poiService)
}

export const getSelectedNetwork = (store: RootDaoState) => {
  if (store.dao.network) {
    return store.dao.network
  }
  throw new Error('Missing network')
}
