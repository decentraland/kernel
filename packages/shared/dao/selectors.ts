import { RootDaoState } from './types'
import { HOTSCENES_SERVICE, POI_SERVICE } from 'config'
import { urlWithProtocol } from 'shared/bff/resolver'
import { RootBffState } from 'shared/bff/types'

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
