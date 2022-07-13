import { Realm } from 'shared/dao/types'

export function resolveCommsV2Url(realm: Realm) {
  return `${realm.hostname}/comms/status`
}
