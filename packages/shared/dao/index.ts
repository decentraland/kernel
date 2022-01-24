import { Store } from 'redux'

import defaultLogger from '../logger'
import {
  Layer,
  Realm,
  Candidate,
  RootDaoState,
  ServerConnectionStatus,
  HealthStatus,
  LayerBasedCandidate,
  IslandsBasedCandidate,
  Parcel
} from './types'
import {
  isRealmInitialized,
  getCatalystRealmCommsStatus,
  getRealm,
  getAllCatalystCandidates,
  areCandidatesFetched
} from './selectors'
import { fetchCatalystNodesFromDAO } from 'shared/web3'
import { setCatalystRealm, setCatalystCandidates } from './actions'
import { deepEqual } from 'atomicHelpers/deepEqual'
import { worldToGrid } from 'atomicHelpers/parcelScenePositions'
import { lastPlayerPosition } from 'shared/world/positionThings'
import { countParcelsCloseTo, ParcelArray } from 'shared/comms/interface/utils'
import { CatalystNode } from '../types'
import { realmToString } from './utils/realmToString'
import { PIN_CATALYST } from 'config'
import * as qs from 'query-string'
import { store } from 'shared/store/isolatedStore'
import { getPickRealmsAlgorithmConfig } from 'shared/meta/selectors'
import { defaultChainConfig } from './pick-realm-algorithm/defaults'
import { createAlgorithm } from './pick-realm-algorithm'
import { ping } from './utils/ping'

const DEFAULT_TIMEOUT = 5000

async function fetchCatalystNodes(endpoint: string | undefined) {
  if (endpoint) {
    try {
      const response = await fetch(endpoint)
      if (response.ok) {
        const nodes = await response.json()
        return nodes.map((node: any) => ({ ...node, domain: node.address }))
      } else {
        throw new Error('Response was not OK. Status was: ' + response.statusText)
      }
    } catch (e) {
      defaultLogger.warn(`Tried to fetch catalysts from ${endpoint} but failed. Falling back to DAO contract`, e)
    }
  }

  return fetchCatalystNodesFromDAO()
}

export async function fetchCatalystRealms(nodesEndpoint: string | undefined): Promise<Candidate[]> {
  const nodes: CatalystNode[] = PIN_CATALYST ? [{ domain: PIN_CATALYST }] : await fetchCatalystNodes(nodesEndpoint)
  if (nodes.length === 0) {
    throw new Error('no nodes are available in the DAO for the current network')
  }

  const responses = await Promise.all(
    nodes.map(async (node) => ({ ...node, health: await fetchPeerHealthStatus(node) }))
  )

  const healthyNodes = responses.filter((node) => isPeerHealthy(node.health))

  return fetchCatalystStatuses(healthyNodes)
}

async function fetchPeerHealthStatus(node: CatalystNode) {
  const abortController = new AbortController()

  const signal = abortController.signal
  try {
    setTimeout(() => {
      abortController.abort()
    }, DEFAULT_TIMEOUT)

    const response = await (await fetch(peerHealthStatusUrl(node.domain), { signal })).json()

    return response
  } catch {
    return {}
  }
}

export function isPeerHealthy(peerStatus: Record<string, HealthStatus>) {
  return (
    Object.keys(peerStatus).length > 0 &&
    !Object.keys(peerStatus).some((server) => {
      return peerStatus[server] !== HealthStatus.HEALTHY
    })
  )
}

export function peerHealthStatusUrl(domain: string) {
  return `${domain}/lambdas/health`
}

export function commsStatusUrl(domain: string, includeLayers: boolean = false, includeUsersParcels: boolean = false) {
  let url = `${domain}/comms/status`
  const queryParameters: string[] = []

  if (includeLayers) {
    queryParameters.push('includeLayers=true')
  }

  if (includeUsersParcels) {
    queryParameters.push('includeUsersParcels=true')
  }

  if (queryParameters.length > 0) {
    url += '?' + queryParameters.join('&')
  }

  return url
}

export async function fetchCatalystStatuses(nodes: { domain: string }[]) {
  const results = (
    await Promise.all(
      nodes.map(async (node) => ({
        ...(await ping(commsStatusUrl(node.domain, true, true))),
        domain: node.domain
      }))
    )
  ).filter((realm) => (realm.result?.maxUsers ?? 0) > (realm.result?.usersCount ?? -1))

  return results.reduce((union: Candidate[], { domain, elapsed, result, status }) => {
    function buildBaseCandidate() {
      return {
        catalystName: result!.name,
        domain,
        status: status!,
        elapsed: elapsed!,
        lighthouseVersion: result!.version,
        catalystVersion: result!.env.catalystVersion
      }
    }

    function buildLayerCandidate(layer: Layer): LayerBasedCandidate {
      return {
        ...buildBaseCandidate(),
        layer,
        type: 'layer-based',
        domain
      }
    }

    function buildIslandsCandidate(
      usersCount: number,
      usersParcels: Parcel[] | undefined,
      maxUsers: number | undefined
    ): IslandsBasedCandidate {
      return {
        ...buildBaseCandidate(),
        usersCount,
        maxUsers,
        usersParcels,
        type: 'islands-based',
        domain
      }
    }

    if (status === ServerConnectionStatus.OK) {
      if (result!.layers) {
        return [...union, ...result!.layers.map((layer) => buildLayerCandidate(layer))]
      } else {
        return [...union, buildIslandsCandidate(result!.usersCount!, result!.usersParcels, result!.maxUsers)]
      }
    } else return union
  }, new Array<Candidate>())
}

export function pickCatalystRealm(candidates: Candidate[], currentUserParcel: Parcel): Realm {
  let config = getPickRealmsAlgorithmConfig(store.getState())

  if (!config || config.length === 0) {
    config = defaultChainConfig
  }

  const algorithm = createAlgorithm(config)

  return candidateToRealm(algorithm.pickCandidate(candidates, currentUserParcel))
}

export async function candidatesFetched(): Promise<void> {
  if (areCandidatesFetched(store.getState())) {
    return
  }

  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      const fetched = areCandidatesFetched(store.getState())
      if (fetched) {
        unsubscribe()
        return resolve()
      }
    })
  })
}

export async function realmInitialized(): Promise<void> {
  if (isRealmInitialized(store.getState())) {
    return
  }

  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (isRealmInitialized(store.getState())) {
        unsubscribe()
        return resolve()
      }
    })
  })
}

export function getRealmFromString(realmString: string, candidates: Candidate[]) {
  const parts = realmString.split('-')
  if (parts.length === 2) {
    return realmForLayer(parts[0], parts[1], candidates)
  } else {
    return realmFor(parts[0], candidates)
  }
}

function candidateToRealm(candidate: Candidate) {
  const realm: Realm = {
    catalystName: candidate.catalystName,
    domain: candidate.domain,
    lighthouseVersion: candidate.lighthouseVersion
  }

  if (candidate.type === 'layer-based') {
    realm.layer = candidate.layer.name
  }

  return realm
}

function realmForLayer(name: string, layer: string, candidates: Candidate[]): Realm | undefined {
  const candidate = candidates.find(
    (it) => it?.type === 'layer-based' && it.catalystName === name && it.layer.name === layer
  )
  return candidate ? candidateToRealm(candidate) : undefined
}

function realmFor(name: string, candidates: Candidate[]): Realm | undefined {
  const candidate = candidates.find((it) => it?.type === 'islands-based' && it.catalystName === name)
  return candidate ? candidateToRealm(candidate) : undefined
}

export function changeRealm(realmString: string) {
  const candidates = getAllCatalystCandidates(store.getState())

  const realm = getRealmFromString(realmString, candidates)

  if (realm) {
    store.dispatch(setCatalystRealm(realm))
  }

  return realm
}

export async function changeToCrowdedRealm(): Promise<[boolean, Realm]> {
  // TODO: Add support for changing to crowded realm in islands based candidates. Or remove this functionality

  const candidates = await refreshCandidatesStatuses()

  const currentRealm = getRealm(store.getState())!

  const positionAsVector = worldToGrid(lastPlayerPosition)
  const currentPosition = [positionAsVector.x, positionAsVector.y] as ParcelArray

  type RealmPeople = { realm: Realm; closePeople: number }

  let crowdedRealm: RealmPeople = { realm: currentRealm, closePeople: 0 }

  candidates
    .filter(
      (it) =>
        it.type === 'layer-based' &&
        it.layer.usersParcels &&
        it.layer.usersParcels.length > 0 &&
        it.layer.usersCount < it.layer.maxUsers
    )
    .forEach((candidate) => {
      const layer = (candidate as LayerBasedCandidate).layer
      if (layer.usersParcels) {
        let closePeople = countParcelsCloseTo(currentPosition, layer.usersParcels, 4)
        // If it is the realm of the player, we substract 1 to not count ourselves
        if (candidate.catalystName === currentRealm.catalystName && layer.name === currentRealm.layer) {
          closePeople -= 1
        }

        if (closePeople > crowdedRealm.closePeople) {
          crowdedRealm = {
            realm: candidateToRealm(candidate),
            closePeople
          }
        }
      }
    })

  if (!deepEqual(crowdedRealm.realm, currentRealm)) {
    store.dispatch(setCatalystRealm(crowdedRealm.realm))
    await catalystRealmConnected()
    return [true, crowdedRealm.realm]
  } else {
    return [false, currentRealm]
  }
}

export async function refreshCandidatesStatuses() {
  const candidates = await fetchCatalystStatuses(Array.from(getCandidateDomains(store)).map((it) => ({ domain: it })))

  store.dispatch(setCatalystCandidates(candidates))

  return candidates
}

function getCandidateDomains(store: Store<RootDaoState>): Set<string> {
  return new Set(getAllCatalystCandidates(store.getState()).map((it) => it.domain))
}

export async function catalystRealmConnected(): Promise<void> {
  const status = getCatalystRealmCommsStatus(store.getState())

  if (status.status === 'connected') {
    return Promise.resolve()
  } else if (status.status === 'error' || status.status === 'realm-full') {
    return Promise.reject(status.status)
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = store.subscribe(() => {
      const status = getCatalystRealmCommsStatus(store.getState())
      if (status.status === 'connected') {
        resolve()
        unsubscribe()
      } else if (status.status === 'error' || status.status === 'realm-full') {
        reject(status.status)
        unsubscribe()
      }
    })
  })
}

export function observeRealmChange(
  store: Store<RootDaoState>,
  onRealmChange: (previousRealm: Realm | undefined, currentRealm: Realm) => any
) {
  let currentRealm: Realm | undefined = getRealm(store.getState())
  store.subscribe(() => {
    const previousRealm = currentRealm
    currentRealm = getRealm(store.getState())
    if (currentRealm && !deepEqual(previousRealm, currentRealm)) {
      onRealmChange(previousRealm, currentRealm)
    }
  })
}

export function initializeUrlRealmObserver() {
  observeRealmChange(store, (previousRealm, currentRealm) => {
    const q = qs.parse(location.search)
    const realmString = realmToString(currentRealm)

    q.realm = realmString

    history.replaceState({ realm: realmString }, '', `?${qs.stringify(q)}`)
  })
}
