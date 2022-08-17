import defaultLogger from '../logger'
import { Realm, ServerConnectionStatus, Candidate, Parcel } from './types'
import { getAllCatalystCandidates } from './selectors'
import { fetchCatalystNodesFromDAO } from 'shared/web3'
import { CatalystNode } from '../types'
import { PIN_CATALYST } from 'config'
import { store } from 'shared/store/isolatedStore'
import { ping, ask } from './utils/ping'
import { getCommsContext, getRealm, sameRealm } from 'shared/comms/selectors'
import { connectComms } from 'shared/comms'
import { setWorldContext } from 'shared/comms/actions'
import { checkValidRealm } from './sagas'
import { establishingComms } from 'shared/loading/types'
import { commsLogger } from 'shared/comms/context'
import { realmToConnectionString, resolveCommsConnectionString } from 'shared/comms/v3/resolver'

async function fetchCatalystNodes(endpoint: string | undefined): Promise<CatalystNode[]> {
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

export async function fetchCatalystStatus(
  domain: string,
  denylistedCatalysts: string[]
): Promise<Candidate | undefined> {
  if (denylistedCatalysts.includes(domain)) return undefined

  const [aboutResponse, parcelsResponse] = await Promise.all([ask(`${domain}/about`), ask(`${domain}/stats/parcels`)])

  if (aboutResponse.httpStatus !== 404) {
    const result = aboutResponse.result
    if (
      aboutResponse.status === ServerConnectionStatus.OK &&
      result &&
      result.comms &&
      result.configurations &&
      result.bff
    ) {
      const { comms, configurations, bff } = result

      // TODO(hugo): this is kind of hacky, the original representation is much better,
      // but I don't want to change the whole pick-realm algorithm now
      const usersParcels: Parcel[] = []

      if (parcelsResponse.result && parcelsResponse.result.parcels) {
        for (const {
          peersCount,
          parcel: { x, y }
        } of parcelsResponse.result.parcels) {
          const parcel: Parcel = [x, y]
          for (let i = 0; i < peersCount; i++) {
            usersParcels.push(parcel)
          }
        }
      }

      return {
        protocol: comms.protocol,
        catalystName: configurations.realmName,
        domain: domain,
        status: aboutResponse.status,
        elapsed: aboutResponse.elapsed!,
        usersCount: bff.userCount ?? comms.usersCount ?? 0,
        maxUsers: 2000,
        usersParcels
      }
    }

    return undefined
  }

  const [commsResponse, lambdasResponse] = await Promise.all([
    ping(`${domain}/comms/status?includeUsersParcels=true`),
    ping(`${domain}/lambdas/health`)
  ])

  if (
    commsResponse.result &&
    commsResponse.status === ServerConnectionStatus.OK &&
    lambdasResponse.status === ServerConnectionStatus.OK &&
    (commsResponse.result.maxUsers ?? 2000) > (commsResponse.result.usersCount ?? -1)
  ) {
    const result = commsResponse.result
    return {
      protocol: 'v2',
      catalystName: result.name,
      domain: domain,
      status: commsResponse.status,
      elapsed: commsResponse.elapsed!,
      usersCount: result.usersCount ?? 0,
      maxUsers: result.maxUsers ?? 2000,
      usersParcels: result.usersParcels
    }
  }
}

export async function fetchCatalystStatuses(
  nodes: { domain: string }[],
  denylistedCatalysts: string[]
): Promise<Candidate[]> {
  const results: Candidate[] = []

  await Promise.all(
    nodes.map(async (node) => {
      const result = await fetchCatalystStatus(node.domain, denylistedCatalysts)
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

export async function changeRealm(realmString: string, forceChange: boolean = false): Promise<void> {
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
