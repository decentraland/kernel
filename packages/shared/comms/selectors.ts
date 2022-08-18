import { Realm } from 'shared/dao/types'
import type { CommsContext } from './context'
import { RootCommsState } from './types'

export const getCommsIsland = (store: RootCommsState): string | undefined => store.comms.island
export const getRealm = (store: RootCommsState): Realm | undefined => store.comms.context?.realm
export const getCommsContext = (state: RootCommsState): CommsContext | undefined => state.comms.context

export function sameRealm(realm1: Realm, realm2: Realm) {
  return (
    realm1.protocol === realm2.protocol &&
    realm1.hostname === realm2.hostname &&
    realm1.serverName === realm2.serverName
  )
}
