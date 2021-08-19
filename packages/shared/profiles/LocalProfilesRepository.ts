import { Profile } from './types'
import { getFromPersistentStorage, removeFromPersistentStorage, saveToPersistentStorage } from 'atomicHelpers/persistentStorage'
import { ETHEREUM_NETWORK } from 'config'

const LOCAL_PROFILES_KEY = 'dcl-local-profile'

export class LocalProfilesRepository {
  persist(address: string, network: ETHEREUM_NETWORK, profile: Profile) {
    // For now, we use local storage. BUT DON'T USE THIS KEY OUTSIDE BECAUSE THIS MIGHT CHANGE EVENTUALLY
    saveToPersistentStorage(this.profileKey(address, network), profile)
  }

  remove(address: string, network: ETHEREUM_NETWORK) {
    return removeFromPersistentStorage(this.profileKey(address, network))
  }

  get(address: string, network: ETHEREUM_NETWORK) {
    return getFromPersistentStorage(this.profileKey(address, network))
  }

  private profileKey(address: string, network: ETHEREUM_NETWORK): string {
    return `${LOCAL_PROFILES_KEY}-${network}-${address}`
  }
}
