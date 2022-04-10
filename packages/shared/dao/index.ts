import { Store } from 'redux'

import defaultLogger from '../logger'
import { Realm, RootDaoState, ServerConnectionStatus, HealthStatus, Candidate, Parcel, PingResult } from './types'
import { getAllCatalystCandidates, areCandidatesFetched } from './selectors'
import { fetchCatalystNodesFromDAO } from 'shared/web3'
import { setCatalystCandidates } from './actions'
import { CatalystNode } from '../types'
import { PIN_CATALYST } from 'config'
import { store } from 'shared/store/isolatedStore'
import { ping } from './utils/ping'
import { resolveCommsConnectionString } from './utils/realmToString'
import { getCommsContext, getRealm, sameRealm } from 'shared/comms/selectors'
import { connectComms } from 'shared/comms'
import { setWorldContext } from 'shared/comms/actions'

const DEFAULT_TIMEOUT = 5000

async function fetchCatalystNodes(endpoint: string | undefined) {
  if (endpoint) {
    try {
      const response = await fetch(endpoint)
      if (response.ok) {
        const nodes = await response.json()
        if (nodes.length) {
          return nodes.map((node: any) => ({ ...node, domain: node.address }))
        }
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

  const healthyNodes = responses.filter((node: CatalystNode & { health: any }) => isPeerHealthy(node.health))

  return fetchCatalystStatuses(healthyNodes)
}

async function fetchPeerHealthStatus(node: CatalystNode) {
  const abortController = new AbortController()

  const signal = abortController.signal
  try {
    setTimeout(() => {
      abortController.abort()
    }, DEFAULT_TIMEOUT)

    function peerHealthStatusUrl(domain: string) {
      return `${domain}/lambdas/health`
    }

    const response = await fetch(peerHealthStatusUrl(node.domain), { signal })

    if (!response.ok) return {}

    const json = await response.json()

    return json
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

export function commsStatusUrl(domain: string, includeUsersParcels: boolean = false) {
  let url = `${domain}/comms/status`
  const queryParameters: string[] = []

  if (includeUsersParcels) {
    queryParameters.push('includeUsersParcels=true')
  }

  if (queryParameters.length > 0) {
    url += '?' + queryParameters.join('&')
  }

  return url
}

export async function fetchCatalystStatuses(nodes: { domain: string }[]) {
  const results: Array<PingResult & { domain: string }> = (
    await Promise.all(
      nodes.map(async (node) => ({
        ...(await ping(commsStatusUrl(node.domain, true))),
        domain: node.domain
      }))
    )
  ).filter((realm: PingResult & { domain: string }) => (realm.result?.maxUsers ?? 0) > (realm.result?.usersCount ?? -1))

  return results.reduce((union: Candidate[], { domain, elapsed, result, status }) => {
    function buildIslandsCandidate(
      usersCount: number,
      usersParcels: Parcel[] | undefined,
      maxUsers: number | undefined
    ): Candidate {
      return {
        type: 'islands-based',
        protocol: 'v2',
        catalystName: result!.name,
        domain,
        status: status!,
        elapsed: elapsed!,
        lighthouseVersion: result!.version,
        catalystVersion: result!.env.catalystVersion,
        usersCount,
        maxUsers,
        usersParcels
      }
    }

    if (status === ServerConnectionStatus.OK) {
      return [...union, buildIslandsCandidate(result!.usersCount!, result!.usersParcels, result!.maxUsers)]
    } else return union
  }, new Array<Candidate>())
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
  if (getRealm(store.getState())) {
    return
  }

  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (getRealm(store.getState())) {
        unsubscribe()
        return resolve()
      }
    })
  })
}

export async function changeRealm(realmString: string, forceChange: boolean = false) {
  const candidates = getAllCatalystCandidates(store.getState())

  const realm = await resolveCommsConnectionString(realmString, candidates)

  if (realm) {
    return changeRealmObject(realm, forceChange)
  }

  throw new Error(`Can't resolve realm ${realmString}`)
}

export async function changeRealmObject(realm: Realm, forceChange: boolean = false) {
  const context = getCommsContext(store.getState())

  // if not forceChange, then cancel operation if we are inside the desired realm
  if (!forceChange && context && sameRealm(context.realm, realm)) {
    return realm
  }

  const newCommsContext = await connectComms(realm)

  store.dispatch(setWorldContext(newCommsContext))

  return realm
}

;(globalThis as any).changeRealm = changeRealm

export async function refreshCandidatesStatuses() {
  const candidates = await fetchCatalystStatuses(Array.from(getCandidateDomains(store)).map((it) => ({ domain: it })))

  store.dispatch(setCatalystCandidates(candidates))

  return candidates
}

function getCandidateDomains(store: Store<RootDaoState>): Set<string> {
  return new Set(getAllCatalystCandidates(store.getState()).map((it) => it.domain))
}
