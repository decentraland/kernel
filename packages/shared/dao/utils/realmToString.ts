import { Realm } from '../types'

export function realmToString(realm: Realm) {
  return realm.protocol + ':' + realm.domain
}

export function parseRealmString(realmString: string): Realm | undefined {
  if (realmString.includes(':')) {
    const parts = realmString.split(':')
    return {
      protocol: parts[0],
      serverName: parts[1],
      domain: parts[1]
    }
  }
  return undefined
}
