import {
  setCatalystCandidates,
  SET_CATALYST_CANDIDATES,
  SetCatalystCandidates,
  catalystRealmsScanRequested
} from './actions'
import { call, put, takeEvery, select, take } from 'redux-saga/effects'
import { PIN_CATALYST, ETHEREUM_NETWORK, PREVIEW, rootURLPreviewMode } from 'config'
import { waitForMetaConfigurationInitialization, waitForNetworkSelected } from '../meta/sagas'
import { Candidate, PingResult, Realm, ServerConnectionStatus } from './types'
import { fetchCatalystRealms, fetchCatalystStatuses, changeRealm } from '.'
import { ping } from './utils/ping'
import {
  getAddedServers,
  getCatalystNodesEndpoint,
  getDisabledCatalystConfig,
  getPickRealmsAlgorithmConfig
} from 'shared/meta/selectors'
import {
  getAllCatalystCandidates,
  getCatalystCandidatesReceived,
  getFetchContentServer,
  getUpdateProfileServer
} from './selectors'
import { saveToPersistentStorage, getFromPersistentStorage } from '../../atomicHelpers/persistentStorage'
import {
  BringDownClientAndShowError,
  ErrorContext,
  ReportFatalErrorWithCatalystPayload
} from 'shared/loading/ReportFatalError'
import { CATALYST_COULD_NOT_LOAD } from 'shared/loading/types'
import { commsLogger } from 'shared/comms/context'
import { parseParcelPosition } from 'atomicHelpers/parcelScenePositions'

import { createAlgorithm } from './pick-realm-algorithm/index'
import { AlgorithmChainConfig } from './pick-realm-algorithm/types'
import { defaultChainConfig } from './pick-realm-algorithm/defaults'
import defaultLogger from 'shared/logger'
import { SET_WORLD_CONTEXT } from 'shared/comms/actions'
import { getCommsRoom } from 'shared/comms/selectors'
import { CatalystNode } from 'shared/types'
import { candidateToRealm, resolveRealmBaseUrlFromRealmQueryParameter, urlWithProtocol } from 'shared/bff/resolver'
import { getCurrentIdentity } from 'shared/session/selectors'
import { USER_AUTHENTIFIED } from 'shared/session/actions'
import { getBff } from 'shared/bff/selectors'
import { SET_BFF } from 'shared/bff/actions'
import { IBff } from 'shared/bff/types'

function* waitForExplorerIdentity() {
  while (!(yield select(getCurrentIdentity))) {
    yield take(USER_AUTHENTIFIED)
  }
}

function getLastRealmCacheKey(network: ETHEREUM_NETWORK) {
  return 'last_realm_string_' + network
}
function getLastRealmCandidatesCacheKey(network: ETHEREUM_NETWORK) {
  return 'last_realm_string_candidates_' + network
}

export function* daoSaga(): any {
  yield takeEvery(SET_BFF, cacheCatalystRealm)
  yield takeEvery(SET_CATALYST_CANDIDATES, cacheCatalystCandidates)
}

function* pickCatalystRealm() {
  const candidates: Candidate[] = yield select(getAllCatalystCandidates)
  if (candidates.length === 0) return undefined

  let config: AlgorithmChainConfig | undefined = yield select(getPickRealmsAlgorithmConfig)

  if (!config || config.length === 0) {
    config = defaultChainConfig
  }

  const algorithm = createAlgorithm(config)

  const qs = new URLSearchParams(globalThis.location.search)
  const currentUserParcel = parseParcelPosition(qs.get('position') || '0,0')

  const realm: Realm = yield call(
    candidateToRealm,
    algorithm.pickCandidate(candidates, [currentUserParcel.x, currentUserParcel.y])
  )

  return urlWithProtocol(realm.hostname)
}

function qsRealm() {
  const qs = new URLSearchParams(document.location.search)
  return qs.get('realm')
}

/**
 * This method will try to load the candidates as well as the selected realm.
 *
 * The strategy to select the realm in terms of priority is:
 * 1- Realm configured in the URL and cached candidate for that realm (uses cache, forks async candidate initialization)
 * 2- Realm configured in the URL but no corresponding cached candidate (implies sync candidate initialization)
 * 3- Last cached realm (uses cache, forks async candidate initialization)
 * 4- Best pick from candidate scan (implies sync candidate initialization)
 */
export function* selectAndReconnectRealm() {
  try {
    const realm: string | undefined = yield call(selectRealm)

    if (realm) {
      yield call(waitForExplorerIdentity)
      yield call(changeRealm, realm, true)
    } else {
      throw new Error("Couldn't select a suitable realm to join.")
    }
    // if no realm was selected, then do the whole initialization dance
  } catch (e: any) {
    debugger
    ReportFatalErrorWithCatalystPayload(e, ErrorContext.KERNEL_INIT)
    BringDownClientAndShowError(CATALYST_COULD_NOT_LOAD)
    throw e
  }
}

function* waitForCandidates() {
  while (!(yield select(getCatalystCandidatesReceived))) {
    yield take(SET_CATALYST_CANDIDATES)
  }
}

function* selectRealm() {
  const network: ETHEREUM_NETWORK = yield call(waitForNetworkSelected)

  yield call(initializeCatalystCandidates)

  const candidatesReceived = yield select(getCatalystCandidatesReceived)

  if (!candidatesReceived) {
    yield call(waitForCandidates)
  }

  // load candidates if necessary
  const allCandidates: Candidate[] = yield select(getAllCatalystCandidates)

  const cachedCandidates: Candidate[] = yield call(getFromPersistentStorage, getLastRealmCandidatesCacheKey(network)) ??
    []

  const realm: string | undefined =
    // query param (dao candidates & cached)
    (yield call(getConfiguredRealm, [...allCandidates, ...cachedCandidates])) ||
    // preview mode
    (PREVIEW ? rootURLPreviewMode() : null) ||
    // CATALYST from url parameter
    PIN_CATALYST ||
    // fetch catalysts and select one using the load balancing
    (yield call(pickCatalystRealm)) ||
    // cached in local storage
    (yield call(getRealmFromLocalStorage, network))

  if (!realm) debugger

  console.log(`Trying to connect to realm `, realm)

  return realm
}

// load realm from local storage
async function getRealmFromLocalStorage(network: ETHEREUM_NETWORK) {
  const key = getLastRealmCacheKey(network)
  try {
    const realm: string = await getFromPersistentStorage(key)
    if (typeof realm === 'string' && realm && (await checkValidRealm(realm))) {
      return realm
    }
  } catch {
    await saveToPersistentStorage(key, null)
  }
}

// Gets a realm from the query parameters (if present)
function* getConfiguredRealm(candidates: Candidate[]) {
  const realmName = qsRealm()
  if (realmName) {
    const realm = yield call(resolveRealmBaseUrlFromRealmQueryParameter, realmName, candidates)
    const isValid: boolean = realm && (yield call(checkValidRealm, realm))
    if (isValid) {
      return realm
    } else {
      commsLogger.warn(`Provided realm is not valid: ${realmName}`)
    }
  }
}

function* initializeCatalystCandidates() {
  yield call(waitForMetaConfigurationInitialization)
  yield put(catalystRealmsScanRequested())

  const catalystsNodesEndpointURL: string | undefined = yield select(getCatalystNodesEndpoint)

  const nodes: CatalystNode[] = yield call(fetchCatalystRealms, catalystsNodesEndpointURL)
  const added: string[] = yield select(getAddedServers)

  const denylistedCatalysts: string[] = (yield select(getDisabledCatalystConfig)) ?? []

  const candidates: Candidate[] = yield call(
    fetchCatalystStatuses,
    added.map((url) => ({ domain: url })).concat(nodes),
    denylistedCatalysts
  )

  yield put(setCatalystCandidates(candidates))
}

export async function checkValidRealm(baseUrl: string): Promise<PingResult | null> {
  const pingResult = await ping(baseUrl + '/about')
  if (pingResult.status === ServerConnectionStatus.OK) {
    return pingResult
  }
  return null
}

function* cacheCatalystRealm() {
  const network: ETHEREUM_NETWORK = yield call(waitForNetworkSelected)
  const realm: IBff | undefined = yield select(getBff)

  if (realm) {
    yield call(saveToPersistentStorage, getLastRealmCacheKey(network), realm.baseUrl)
  }

  // PRINT DEBUG INFO
  const dao: string = yield select((state) => state.dao)
  const fetchContentServer: string = yield select(getFetchContentServer)
  const updateContentServer: string = yield select(getUpdateProfileServer)

  defaultLogger.info(`Using Catalyst configuration: `, {
    original: dao,
    calculated: {
      fetchContentServer,
      updateContentServer
    }
  })
}

function* cacheCatalystCandidates(_action: SetCatalystCandidates) {
  const allCandidates: Candidate[] = yield select(getAllCatalystCandidates)
  const network: ETHEREUM_NETWORK = yield call(waitForNetworkSelected)
  yield call(saveToPersistentStorage, getLastRealmCandidatesCacheKey(network), allCandidates)
}

export function* waitForRealmInitialized() {
  while (!(yield select(getCommsRoom))) {
    yield take(SET_WORLD_CONTEXT)
  }
}
