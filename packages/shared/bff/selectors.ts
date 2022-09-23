import { Realm } from 'shared/dao/types'
import { IBff, RootBffState } from './types'

export const getRealm = (store: RootBffState): Realm | undefined => store.bff.bff?.realm
export const getBff = (state: RootBffState): IBff | undefined => state.bff.bff

export function sameRealm(realm1: Realm, realm2: Realm) {
  return (
    realm1.protocol === realm2.protocol &&
    realm1.hostname === realm2.hostname &&
    realm1.serverName === realm2.serverName
  )
}
