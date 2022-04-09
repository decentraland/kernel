import { Candidate, Realm } from '../types'

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
      hostname: secondPart
    }
  }

  return undefined
}

export async function candidateToRealm(candidate: Candidate): Promise<Realm> {
  return {
    hostname: candidate.domain,
    protocol: candidate.protocol || 'v2',
    serverName: candidate.catalystName
  }
}
