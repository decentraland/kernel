import { Candidate, Realm } from 'shared/dao/types'
import { AboutResponse } from 'shared/protocol/bff/http-endpoints.gen'
import { ExplorerIdentity } from 'shared/session/types'
import { createBffRpcConnection } from './connections/BFFConnection'
import { localBff } from './connections/BFFLegacy'
import { IBff } from './types'

function normalizeUrl(url: string) {
  return url.replace(/^:\/\//, window.location.protocol + '//')
}

// adds the currently used protocol to the given URL
export function urlWithProtocol(urlOrHostname: string) {
  if (!urlOrHostname.startsWith('http://') && !urlOrHostname.startsWith('https://') && !urlOrHostname.startsWith('://'))
    return normalizeUrl(`://${urlOrHostname}`)

  return normalizeUrl(urlOrHostname)
}

export async function bffForRealm(baseUrl: string, about: AboutResponse, identity: ExplorerIdentity): Promise<IBff> {
  // connect the real BFF
  if (about.comms?.protocol === 'v3') {
    return createBffRpcConnection(baseUrl, about, identity)
  }

  // return a mocked BFF
  return localBff(baseUrl, about, identity)
}

export function prettyRealmName(realm: string, candidates: Candidate[]) {
  // is it a DAO realm?
  for (const candidate of candidates) {
    if (candidate.catalystName === realm) {
      return candidate.catalystName
    }
  }

  return realm
}

export function realmToConnectionString(realm: IBff) {
  if (realm.about.comms?.protocol === 'v2' && realm.about.configurations?.realmName?.match(/^[a-z]+$/i)) {
    return realm.about.configurations.realmName
  }

  return 'v3~' + realm.baseUrl.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '')
}

export function resolveRealmBaseUrlFromRealmQueryParameter(
  realmString: string,
  candidates: Candidate[]
): string | undefined {
  // is it a DAO realm?
  for (const candidate of candidates) {
    if (candidate.catalystName === realmString) {
      return urlWithProtocol(candidate.domain)
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
        return urlWithProtocol(secondPart)
      }
    }

    return urlWithProtocol(secondPart)
  }

  if (realmString.startsWith('http:') || realmString.startsWith('https:')) return realmString
}

export function candidateToRealm(candidate: Candidate): Realm {
  return {
    hostname: urlWithProtocol(candidate.domain),
    protocol: candidate.protocol || 'v2',
    serverName: candidate.catalystName
  }
}
