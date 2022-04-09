import {
  setCatalystCandidates,
  setAddedCatalystCandidates,
  SET_CATALYST_REALM,
  SetCatalystRealm,
  SET_CATALYST_CANDIDATES,
  SET_ADDED_CATALYST_CANDIDATES,
  SetCatalystCandidates,
  SetAddedCatalystCandidates,
  catalystRealmsScanRequested,
  SELECT_NETWORK,
  setCatalystRealm,
  HANDLE_COMMS_DISCONNECTION,
  HandleCommsDisconnection,
} from './actions'
import { call, put, takeEvery, select, take } from 'redux-saga/effects'
import { PIN_CATALYST, ETHEREUM_NETWORK, PREVIEW, rootURLPreviewMode } from 'config'
import { waitForMetaConfigurationInitialization } from '../meta/sagas'
import { Candidate, PingResult, Realm, ServerConnectionStatus } from './types'
import { fetchCatalystRealms, fetchCatalystStatuses, pickCatalystRealm, commsStatusUrl } from '.'
import { ping } from './utils/ping'
import { getAddedServers, getCatalystNodesEndpoint, getMinCatalystVersion } from 'shared/meta/selectors'
import {
  getAllCatalystCandidates,
  getFetchContentServer,
  getRealm,
  getSelectedNetwork,
  getUpdateProfileServer,
  isRealmInitialized
} from './selectors'
import { saveToPersistentStorage, getFromPersistentStorage } from '../../atomicHelpers/persistentStorage'
import defaultLogger from '../logger'
import {
  BringDownClientAndShowError,
  ErrorContext,
  ReportFatalErrorWithCatalystPayload
} from 'shared/loading/ReportFatalError'
import { CATALYST_COULD_NOT_LOAD } from 'shared/loading/types'
import { gte } from 'semver'
import { realmToConnectionString, resolveCommsConnectionString } from './utils/realmToString'
import { commsLogger } from 'shared/comms/context'
import { notifyStatusThroughChat } from 'shared/comms/chat'

function getLastRealmCacheKey(network: ETHEREUM_NETWORK) {
  return 'last_realm_' + network
}
function getLastRealmCandidatesCacheKey(network: ETHEREUM_NETWORK) {
  return 'last_realm_candidates_' + network
}

export function* daoSaga(): any {
  yield takeEvery(SELECT_NETWORK, loadCatalystRealms)
  yield takeEvery(SET_CATALYST_REALM, cacheCatalystRealm)
  yield takeEvery([SET_CATALYST_CANDIDATES, SET_ADDED_CATALYST_CANDIDATES], cacheCatalystCandidates)
  yield takeEvery(HANDLE_COMMS_DISCONNECTION, handleCommsDisconnection)
}

function* handleCommsDisconnection(action: HandleCommsDisconnection) {
  const realm = yield select(getRealm)

  if (realm) {
    notifyStatusThroughChat(`Lost connection to ${realmToConnectionString(realm)}`)
  }

  const candidates = yield select(getAllCatalystCandidates)
  const otherRealm = yield call(pickCatalystRealm, candidates)

  notifyStatusThroughChat(`Joining realm ${realmToConnectionString(otherRealm)}`)

  yield put(setCatalystRealm(otherRealm))
}

function qsRealm() {
  const qs = new URLSearchParams(document.location.search)
  return qs.get('realm')
}

/**
 * This method will try to load the candidates as well as the selected realm.
 *
 * The strategy to select the realm in terms of priority is:
 * 1- Realm configured in the URL and cached candidate for that realm (uses cache, forks async candidadte initialization)
 * 2- Realm configured in the URL but no corresponding cached candidate (implies sync candidate initialization)
 * 3- Last cached realm (uses cache, forks async candidadte initialization)
 * 4- Best pick from candidate scan (implies sync candidate initialization)
 */
function* loadCatalystRealms() {
  yield call(waitForMetaConfigurationInitialization)

  let realm: Realm | undefined

  if (!PREVIEW) {
    // load candidates if necessary
    const candidates: Candidate[] = yield select(getAllCatalystCandidates)
    if (candidates.length == 0) {
      yield call(initializeCatalystCandidates)
    }

    try {
      realm = yield call(selectRealm)

      // if no realm was selected, then do the whole initialization dance
    } catch (e: any) {
      ReportFatalErrorWithCatalystPayload(e, ErrorContext.KERNEL_INIT)
      BringDownClientAndShowError(CATALYST_COULD_NOT_LOAD)
      throw e
    }
  } else {
    yield initLocalCatalyst()
    realm = {
      protocol: 'v1',
      hostname: rootURLPreviewMode(),
      serverName: 'localhost'
    }
  }

  if (!realm) {
    throw new Error('Unable to select a realm')
  }

  yield put(setCatalystRealm(realm))

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

function* initLocalCatalyst() {
  yield put(setCatalystCandidates([]))
  yield put(setAddedCatalystCandidates([]))
}

function* waitForCandidates() {
  while ((yield select(getAllCatalystCandidates)).length === 0) {
    yield take(SET_ADDED_CATALYST_CANDIDATES)
  }
}

export function* selectRealm() {
  yield call(waitForCandidates)
  const network: ETHEREUM_NETWORK = yield select(getSelectedNetwork)

  const allCandidates: Candidate[] = yield select(getAllCatalystCandidates)
  const cachedCandidates: Candidate[] = yield call(getFromPersistentStorage, getLastRealmCandidatesCacheKey(network)) ??
    []

  const realm: Realm | undefined =
    // 1st priority: query param (dao candidates & cached)
    (yield call(getConfiguredRealm, [...allCandidates, ...cachedCandidates])) ||
    // 2nd priority: cached in local storage
    (yield call(getFromPersistentStorage, getLastRealmCacheKey(network))) ||
    // 3rd priority: fetch catalysts and select one using the load balancing
    (yield call(pickCatalystRealm, allCandidates))

  return realm
}

// Gets a realm from the query parameters (if present)
function* getConfiguredRealm(candidates: Candidate[]) {
  const realmName = qsRealm()
  if (realmName) {
    const realm = yield call(resolveCommsConnectionString, realmName, candidates)
    const isValid: boolean = realm && (yield call(checkValidRealm, realm))
    if (isValid) {
      return realm
    } else {
      commsLogger.warn(`Provided realm is not valid: ${realmName}`)
    }
  }
}

function* filterCandidatesByCatalystVersion(candidates: Candidate[]) {
  const minCatalystVersion: string | undefined = yield select(getMinCatalystVersion)
  const filteredCandidates = minCatalystVersion
    ? candidates.filter(({ catalystVersion }) => gte(catalystVersion, minCatalystVersion))
    : candidates
  return filteredCandidates
}

function* initializeCatalystCandidates() {
  yield put(catalystRealmsScanRequested())
  const catalystsNodesEndpointURL: string | undefined = yield select(getCatalystNodesEndpoint)
  const candidates: Candidate[] = yield call(fetchCatalystRealms, catalystsNodesEndpointURL)
  const filteredCandidates: Candidate[] = PIN_CATALYST
    ? candidates
    : yield call(filterCandidatesByCatalystVersion, candidates)

  yield put(setCatalystCandidates(filteredCandidates))

  const added: string[] = PIN_CATALYST ? [] : yield select(getAddedServers)
  const addedCandidates: Candidate[] = yield call(
    fetchCatalystStatuses,
    added.map((url) => ({ domain: url }))
  )
  const filteredAddedCandidates: Candidate[] = yield call(filterCandidatesByCatalystVersion, addedCandidates)

  yield put(setAddedCatalystCandidates(filteredAddedCandidates))
}

function* checkValidRealm(realm: Realm) {
  const realmHasValues = realm && realm.hostname && realm.serverName
  if (!realmHasValues) {
    return false
  }
  const minCatalystVersion: string | undefined = yield select(getMinCatalystVersion)
  const pingResult: PingResult = yield ping(commsStatusUrl(realm.hostname))
  const catalystVersion = pingResult.result?.env.catalystVersion ?? '0.0.0'
  return (
    pingResult.status === ServerConnectionStatus.OK && (!minCatalystVersion || gte(catalystVersion, minCatalystVersion))
  )
}

function* cacheCatalystRealm(action: SetCatalystRealm) {
  const network: ETHEREUM_NETWORK = yield select(getSelectedNetwork)
  yield call(saveToPersistentStorage, getLastRealmCacheKey(network), action.payload)
}

function* cacheCatalystCandidates(_action: SetCatalystCandidates | SetAddedCatalystCandidates) {
  const allCandidates: Candidate[] = yield select(getAllCatalystCandidates)
  const network: ETHEREUM_NETWORK = yield select(getSelectedNetwork)
  yield call(saveToPersistentStorage, getLastRealmCandidatesCacheKey(network), allCandidates)
}

export function* waitForRealmInitialized() {
  while (!(yield select(isRealmInitialized))) {
    yield take(SET_CATALYST_REALM)
  }
}
