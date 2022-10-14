import defaultLogger from '../logger'
import { ServerConnectionStatus, Candidate, Parcel } from './types'
import { getAllCatalystCandidates } from './selectors'
import { fetchCatalystNodesFromDAO } from 'shared/web3'
import { CatalystNode } from '../types'
import { PIN_CATALYST } from 'config'
import { store } from 'shared/store/isolatedStore'
import { ask } from './utils/ping'
import { getBff } from 'shared/bff/selectors'
import { setBff } from 'shared/bff/actions'
import { checkValidRealm } from './sagas'
import { commsLogger } from 'shared/comms/context'
import { getCurrentIdentity } from 'shared/session/selectors'
import { bffForRealm, prettyRealmName, resolveRealmBaseUrlFromRealmQueryParameter } from 'shared/bff/resolver'
import { AboutResponse } from '@dcl/protocol/out-ts/decentraland/bff/http_endpoints.gen'

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

  const aboutResponse = await ask(`${domain}/about`)

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

      return {
        protocol: comms.protocol,
        catalystName: configurations.realmName,
        domain: domain,
        status: aboutResponse.status,
        elapsed: aboutResponse.elapsed!,
        usersCount: bff.userCount || comms.usersCount || 0,
        maxUsers: 2000,
        usersParcels
      }
    }

    return undefined
  }

  return undefined
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
  if (getBff(store.getState())) {
    return
  }

  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (getBff(store.getState())) {
        unsubscribe()
        return resolve()
      }
    })
  })
}

export async function changeRealm(realmString: string, forceChange: boolean = false): Promise<void> {
  const candidates = getAllCatalystCandidates(store.getState())

  const realmBaseUrl = resolveRealmBaseUrlFromRealmQueryParameter(realmString, candidates)

  if (!realmBaseUrl) {
    throw new Error(`Can't resolve realm ${realmString}`)
  }

  const currentBff = getBff(store.getState())
  const identity = getCurrentIdentity(store.getState())

  if (!identity) throw new Error('Cant change realm without a valid identity')

  commsLogger.info('Connecting to realm', realmString)

  // if not forceChange, then cancel operation if we are inside the desired realm
  if (!forceChange && currentBff && currentBff.baseUrl === realmBaseUrl) {
    return
  }

  let about: AboutResponse

  if (realmString.startsWith(`offline~`)) {
    about = {
      bff: undefined,
      comms: { healthy: false, protocol: 'offline', fixedAdapter: realmString },
      configurations: {
        realmName: 'offline',
        networkId: 1,
        globalScenesUrn: [],
        scenesUrn: []
      },
      content: {
        healthy: true,
        publicUrl: 'https://peer.decentraland.org/content'
      },
      healthy: true,
      lambdas: {
        healthy: true,
        publicUrl: 'https://peer.decentraland.org/lambdas'
      }
    }
  } else {
    const res = await checkValidRealm(realmBaseUrl)
    if (!res || !res.result) {
      throw new Error(`The realm ${prettyRealmName(realmString, candidates)} isn't available right now.`)
    }
    about = res.result!
  }

  const newBff = await bffForRealm(realmBaseUrl, about, identity)

  if (newBff) {
    store.dispatch(setBff(newBff))
  } else {
    throw new Error(`Can't connect to realm ${realmString} right now.`)
  }

  return
}

;(globalThis as any).changeRealm = changeRealm
