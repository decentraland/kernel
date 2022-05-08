import { Candidate, Realm } from 'shared/dao/types'

function normalizeUrl(url: string) {
  return url.replace(/^:\/\//, window.location.protocol + '//')
}

// adds the currently used protocol to the given URL
export function urlWithProtocol(urlOrHostname: string) {
  if (!urlOrHostname.startsWith('http://') && !urlOrHostname.startsWith('https://') && !urlOrHostname.startsWith('://'))
    return normalizeUrl(`://${urlOrHostname}`)

  return normalizeUrl(urlOrHostname)
}

export function resolveCommsV3Urls(realm: Realm): { pingUrl: string; wsUrl: string } | undefined {
  if (realm.protocol !== 'v3') return

  function httpToWs(url: string) {
    return url.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
  }

  let server = 'https://explorer-bff.decentraland.io'

  if (realm.hostname === 'local') {
    server = 'http://0.0.0.0:5000'
  } else if (realm.hostname === 'remote') {
    server = 'https://explorer-bff.decentraland.io'
  } else {
    server = realm.hostname.match(/:\/\//) ? realm.hostname : 'https://' + realm.hostname
  }

  const pingUrl = new URL('./status', server).toString()
  const wsUrl = httpToWs(new URL('./ws', server).toString())

  return { pingUrl, wsUrl }
}

export function realmToConnectionString(realm: Realm) {
  if (realm.protocol === 'v2' && realm.serverName !== realm.hostname && realm.serverName.match(/^[a-z]+$/i)) {
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

  return undefined
}

export async function candidateToRealm(candidate: Candidate): Promise<Realm> {
  return {
    hostname: urlWithProtocol(candidate.domain),
    protocol: candidate.protocol || 'v2',
    serverName: candidate.catalystName
  }
}
