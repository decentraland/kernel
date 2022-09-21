import { store } from 'shared/store/isolatedStore'
import { isMetaConfigurationInitiazed } from './selectors'

export async function ensureMetaConfigurationInitialized(): Promise<void> {
  const initialized = isMetaConfigurationInitiazed(store.getState())
  if (initialized) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    const unsubscribe = store.subscribe(() => {
      const initialized = isMetaConfigurationInitiazed(store.getState())
      if (initialized) {
        unsubscribe()
        return resolve()
      }
    })
  })
}

export const DEFAULT_MAX_VISIBLE_PEERS = 25

export const DEFAULT_MAX_CHANNELS_VALUE = 5 // Todo Juli!: Is it the right place?
