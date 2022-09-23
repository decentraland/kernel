import { Candidate, Realm } from 'shared/dao/types'
import { ExplorerIdentity } from 'shared/session/types'
import { createBffRpcConnection } from './connections/BFFConnection'
import { localBff } from './connections/BFFLegacy'
import { IBff } from './types'

function normalizeUrl(url: string) {
  return url.replace(/^:\/\//, window.location.protocol + '//')
}

function httpToWs(url: string) {
  return url.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
}

// adds the currently used protocol to the given URL
export function urlWithProtocol(urlOrHostname: string) {
  if (!urlOrHostname.startsWith('http://') && !urlOrHostname.startsWith('https://') && !urlOrHostname.startsWith('://'))
    return normalizeUrl(`://${urlOrHostname}`)

  return normalizeUrl(urlOrHostname)
}

export async function bffForRealm(realm: Realm, identity: ExplorerIdentity): Promise<IBff> {
  // connect the real BFF
  if (realm.protocol === 'v3') {
    const urls = resolveRealmUrls(realm)
    if (urls && urls.wsUrl) return createBffRpcConnection(realm, urls.wsUrl, identity)
  }

  // return a mocked BFF
  return localBff(realm, identity)
}

export function resolveRealmUrls(realm: Realm): { pingUrl: string; wsUrl?: string } | undefined {
  if (realm.protocol === 'v2') {
    return {
      pingUrl: `${realm.hostname}/comms/status`
    }
  }

  if (realm.protocol === 'v3') {
    const server = realm.hostname.match(/:\/\//) ? realm.hostname : 'https://' + realm.hostname

    const pingUrl = new URL('./about', server).toString()
    const wsUrl = httpToWs(new URL('./bff/ws', server).toString())

    return { pingUrl, wsUrl }
  }
}

export function realmToConnectionString(realm: Realm) {
  if (
    realm.protocol === 'v2' &&
    realm.serverName &&
    realm.serverName !== realm.hostname &&
    realm.serverName.match(/^[a-z]+$/i)
  ) {
    return realm.serverName
  }

  return realm.protocol + '~' + realm.hostname.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '')
}

export async function resolveCommsConnectionString(
  realmString: string,
  candidates: Candidate[]
): Promise<Realm | undefined> {
  // is it a DAO realm?
  for (const candidate of candidates) {
    if (candidate.catalystName === realmString) {
      return candidateToRealm(candidate)
    }
  }

  // does it has the protocol?
  if (realmString.includes('~')) {
    const i = realmString.indexOf('~')
    const protocol = realmString.substring(0, i)
    const secondPart = realmString.substring(i + 1)

    if (!secondPart) return undefined

    for (const candidate of candidates) {
      if (
        protocol === candidate.protocol &&
        (candidate.catalystName === secondPart || candidate.domain === secondPart)
      ) {
        return candidateToRealm(candidate)
      }
    }

    return {
      protocol,
      serverName: secondPart,
      hostname: urlWithProtocol(secondPart)
    }
  }

  debugger

  return undefined
}

export async function candidateToRealm(candidate: Candidate): Promise<Realm> {
  return {
    hostname: urlWithProtocol(candidate.domain),
    protocol: candidate.protocol || 'v2',
    serverName: candidate.catalystName
  }
}
