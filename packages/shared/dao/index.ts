import defaultLogger from '../logger'
import { ServerConnectionStatus, Candidate, Parcel } from './types'
import { getAllCatalystCandidates } from './selectors'
import { fetchCatalystNodesFromDAO } from 'shared/web3'
import { CatalystNode } from '../types'
import { PIN_CATALYST } from 'config'
import { store } from 'shared/store/isolatedStore'
import { ask } from './utils/ping'
import { getRealmAdapter } from 'shared/realm/selectors'
import { setRealmAdapter } from 'shared/realm/actions'
import { checkValidRealm } from './sagas'
import { commsLogger } from 'shared/comms/context'
import { getCurrentIdentity } from 'shared/session/selectors'
import {
  adapterForRealmConfig,
  resolveRealmBaseUrlFromRealmQueryParameter,
  urlWithProtocol
} from 'shared/realm/resolver'
import { AboutResponse } from '@dcl/protocol/out-ts/decentraland/bff/http_endpoints.gen'
import { OFFLINE_REALM } from 'shared/realm/types'
import { getDisabledCatalystConfig } from 'shared/meta/selectors'

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
  denylistedCatalysts: string[],
  askFunction: typeof ask
): Promise<Candidate | undefined> {
  if (denylistedCatalysts.includes(domain)) return undefined

  const [aboutResponse, parcelsResponse] = await Promise.all([
    askFunction(`${domain}/about`),
    askFunction(`${domain}/stats/parcels`)
  ])

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
      usersCount: bff.userCount || comms.usersCount || 0,
      maxUsers: 2000,
      usersParcels
    }
  }

  return undefined
}

export async function fetchCatalystStatuses(
  nodes: { domain: string }[],
  denylistedCatalysts: string[],
  askFunction: typeof ask
): Promise<Candidate[]> {
  const results: Candidate[] = []

  await Promise.all(
    nodes.map(async (node) => {
      const result = await fetchCatalystStatus(node.domain, denylistedCatalysts, askFunction)
      if (result) {
        results.push(result)
      }
    })
  )

  return results
}

export async function realmInitialized(): Promise<void> {
  if (getRealmAdapter(store.getState())) {
    return
  }

  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (getRealmAdapter(store.getState())) {
        unsubscribe()
        return resolve()
      }
    })
  })
}

export async function resolveRealmAboutFromBaseUrl(
  realmString: string
): Promise<{ about: AboutResponse; baseUrl: string } | undefined> {
  // load candidates if necessary
  const allCandidates: Candidate[] = getAllCatalystCandidates(store.getState())
  const realmBaseUrl = resolveRealmBaseUrlFromRealmQueryParameter(realmString, allCandidates).replace(/\/+$/, '')

  if (!realmBaseUrl) {
    throw new Error(`Can't resolve realm ${realmString}`)
  }

  const res = await checkValidRealm(realmBaseUrl)
  if (!res || !res.result) {
    return undefined
  }

  return { about: res.result!, baseUrl: realmBaseUrl }
}

async function resolveOfflineRealmAboutFromConnectionString(
  realmString: string
): Promise<{ about: AboutResponse; baseUrl: string } | undefined> {
  if (realmString === OFFLINE_REALM || realmString.startsWith(OFFLINE_REALM + '?')) {
    const params = new URL('decentraland:' + realmString).searchParams
    let baseUrl = urlWithProtocol(params.get('baseUrl') || 'https://peer.decentraland.org')

    if (!baseUrl.endsWith('/')) baseUrl = baseUrl + '/'

    return {
      about: {
        bff: undefined,
        comms: {
          healthy: false,
          protocol: params.get('protocol') || 'offline',
          fixedAdapter: params.get('fixedAdapter') || 'offline:offline'
        },
        configurations: {
          realmName: realmString,
          networkId: 1,
          globalScenesUrn: [],
          scenesUrn: [],
          cityLoaderContentServer: params.get('cityLoaderContentServer') ?? undefined
        },
        content: {
          healthy: true,
          publicUrl: `${baseUrl}content`
        },
        healthy: true,
        lambdas: {
          healthy: true,
          publicUrl: `${baseUrl}lambdas`
        }
      },
      baseUrl: baseUrl.replace(/\/+$/, '')
    }
  }
}

export async function resolveRealmConfigFromString(realmString: string) {
  return (
    (await resolveOfflineRealmAboutFromConnectionString(realmString)) ||
    (await resolveRealmAboutFromBaseUrl(realmString))
  )
}

export async function changeRealm(realmString: string, forceChange: boolean = false): Promise<void> {
  const realmConfig = await resolveRealmConfigFromString(realmString)

  if (!realmConfig) {
    throw new Error(`The realm ${realmString} isn't available right now.`)
  }

  const catalystURL = new URL(realmConfig.baseUrl)

  if (!forceChange) {
    const denylistedCatalysts: string[] = getDisabledCatalystConfig(store.getState()) ?? []
    if (denylistedCatalysts.find((denied) => new URL(denied).host === catalystURL.host)) {
      throw new Error(`The realm is denylisted.`)
    }
  }

  const currentRealmAdapter = getRealmAdapter(store.getState())
  const identity = getCurrentIdentity(store.getState())

  // if not forceChange, then cancel operation if we are inside the desired realm
  if (!forceChange && currentRealmAdapter && currentRealmAdapter.baseUrl === realmConfig.baseUrl) {
    return
  }

  if (!identity) throw new Error('Cant change realm without a valid identity')

  commsLogger.info('Connecting to realm', realmString)

  const newAdapter = await adapterForRealmConfig(realmConfig.baseUrl, realmConfig.about, identity)

  if (newAdapter) {
    store.dispatch(setRealmAdapter(newAdapter))
  } else {
    throw new Error(`Can't connect to realm ${realmString} right now.`)
  }

  return
}

;(globalThis as any).changeRealm = changeRealm
