import { getFeatureFlagEnabled, getFeatureFlagVariantValue } from 'shared/meta/selectors'
import { RootMetaState } from 'shared/meta/types'
import { store } from 'shared/store/isolatedStore'
import { getChannels } from './selectors'

/**
 * Get the local part of the userId from matrixUserId
 * @param userId a string with the matrixUserId pattern
 *
 * @example
 * from: '@0x1111ada11111:decentraland.org'
 * to: '0x1111ada11111'
 * */
export function getUserIdFromMatrix(userId: string) {
  // this means that the id comes from matrix
  if (userId.indexOf('@') === 0) {
    return userId.split(':')[0].substring(1)
  }
  return userId
}

/**
 * Get the matrixUserId from userId
 * @param userId a string with the userId pattern
 *
 * @example
 * from: '0x1111ada11111'
 * to: '@0x1111ada11111:decentraland.org'
 * */
export function getMatrixIdFromUser(userId: string) {
  const domain = store.getState().friends.client?.getDomain() ?? 'decentraland.org'
  return `@${userId.toLowerCase()}:${domain}`
}
/*
 * Returns true if channels feature is enabled
 */
export function areChannelsEnabled(): boolean {
  return getFeatureFlagEnabled(store.getState(), 'matrix_channels_enabled')
}

/**
 * Get the number of channels the user is joined to and check with a feature flag value if the user has reached the maximum amount allowed.
 * @return True - if the user has reached the maximum amount allowed.
 * @return False - if the user has not reached the maximum amount allowed.
 */
 export function checkChannelsLimit() {
  const limit = getMaxChannels(store.getState())

  const joinedChannels = getChannels(store.getState()).length

  if (limit > joinedChannels) {
    return false
  }

  return true
}

export const DEFAULT_MAX_CHANNELS_VALUE = 5

export function getMaxChannels(store: RootMetaState): number {
  return (getFeatureFlagVariantValue(store, 'max_joined_channels') as number) ?? DEFAULT_MAX_CHANNELS_VALUE
}
