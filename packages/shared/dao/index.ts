import defaultLogger from '../logger'
import { Realm, ServerConnectionStatus, Candidate } from './types'
import { getAllCatalystCandidates } from './selectors'
import { fetchCatalystNodesFromDAO } from 'shared/web3'
import { CatalystNode } from '../types'
import { PIN_CATALYST } from 'config'
import { store } from 'shared/store/isolatedStore'
import { ping } from './utils/ping'
import { getCommsContext, getRealm, sameRealm } from 'shared/comms/selectors'
import { connectComms } from 'shared/comms'
import { setWorldContext } from 'shared/comms/actions'
import { checkValidRealm } from './sagas'
import { establishingComms } from 'shared/loading/types'
import { commsLogger } from 'shared/comms/context'
import { realmToConnectionString, resolveCommsConnectionString } from 'shared/comms/v3/resolver'

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

export async function fetchCatalystRealms(nodesEndpoint: string | undefined): Promise<CatalystNode[]> {
  const nodes: CatalystNode[] = PIN_CATALYST ? [{ domain: PIN_CATALYST }] : await fetchCatalystNodes(nodesEndpoint)
  if (nodes.length === 0) {
    throw new Error('no nodes are available in the DAO for the current network')
  }
  return nodes
}

async function fetchCatalystStatus(domain: string): Promise<Candidate | undefined> {
  const [commsResponse, lambdasResponse] = await Promise.all([
    ping(`${domain}/comms/status?includeUsersParcels=true`),
    ping(`${domain}/lambdas/health`)
  ])
  const result = commsResponse.result

  if (
    result &&
    commsResponse.status === ServerConnectionStatus.OK &&
    lambdasResponse.status === ServerConnectionStatus.OK
  ) {
    if ((result.maxUsers ?? 0) > (result.usersCount ?? -1)) {
      return {
        type: 'islands-based',
        protocol: 'v2',
        catalystName: result.name,
        domain: domain,
        status: commsResponse.status,
        elapsed: commsResponse.elapsed!,
        lighthouseVersion: result.version,
        usersCount: result.usersCount ?? 0,
        maxUsers: result.maxUsers ?? -1,
        usersParcels: result.usersParcels
      }
    }
  }
}

export async function fetchCatalystStatuses(nodes: { domain: string }[]): Promise<Candidate[]> {
  const results: Candidate[] = []

  await Promise.all(
    nodes.map(async (node) => {
      const result = await fetchCatalystStatus(node.domain)
      if (result) {
        results.push(result)
      }
    })
  )

  return results
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

  if (!realm) {
    throw new Error(`Can't resolve realm ${realmString}`)
  }

  return changeRealmObject(realm, forceChange)
}

export async function changeRealmObject(realm: Realm, forceChange: boolean = false): Promise<void> {
  const context = getCommsContext(store.getState())

  commsLogger.info('Connecting to realm', realm)

  // if not forceChange, then cancel operation if we are inside the desired realm
  if (!forceChange && context && sameRealm(context.realm, realm)) {
    return
  }

  if (!(await checkValidRealm(realm))) {
    throw new Error(`The realm ${realmToConnectionString(realm)} isn't available right now.`)
  }

  store.dispatch(establishingComms())

  const newCommsContext = await connectComms(realm)

  if (newCommsContext) {
    store.dispatch(setWorldContext(newCommsContext))
  } else {
    throw new Error(`The realm ${realmToConnectionString(realm)} isn't available right now.`)
  }

  return
}

;(globalThis as any).changeRealm = changeRealm
