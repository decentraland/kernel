import { getFeatureFlagEnabled, getFeatureFlagVariantValue } from 'shared/meta/selectors'
import { RootMetaState } from 'shared/meta/types'
import { store } from 'shared/store/isolatedStore'
import { UsersAllowed } from 'shared/types'

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

/**
 * Get the normalized name of a room
 * @param name a string with the name
 *
 * @example
 * from: '#rapanui:decentraland.zone'
 * to: 'rapanui'
 * */
export function getNormalizedRoomName(name: string) {
  // it means we got the name with a inadequate format
  if (name.indexOf('#') === 0) {
    return name.split(':')[0].substring(1)
  }
  return name
}

/*
 * Returns true if channels feature is enabled
 */
export function areChannelsEnabled(): boolean {
  return getFeatureFlagEnabled(store.getState(), 'matrix_channels_enabled')
}

export const DEFAULT_MAX_CHANNELS_VALUE = 10

/*
 * Returns the maximum allowed number of channels a user can join.
 */
export function getMaxChannels(store: RootMetaState): number {
  return (getFeatureFlagVariantValue(store, 'max_joined_channels') as number) ?? DEFAULT_MAX_CHANNELS_VALUE
}

/*
 * Returns a list of users who are allowed to create channels.
 */
export function getUsersAllowedToCreate(store: RootMetaState): UsersAllowed | undefined {
  return getFeatureFlagVariantValue(store, 'users_allowed_to_create_channels') as UsersAllowed | undefined
}

/*
 * Returns true if the new friends requests flow is enabled
 */
export function isNewFriendRequestEnabled(): boolean {
  return getFeatureFlagEnabled(store.getState(), 'new_friend_requests')
}

/**
 * Encode friendRequestId from the user IDs involved in the friendship event.
 * The rule is: `ownId` < `otherUserId` ? `ownId_otherUserId` : `otherUserId_ownId`
 * @param ownId
 * @param otherUserId
 */
export function encodeFriendRequestId(ownId: string, otherUserId: string) {
  // We always want the friendRequestId to be formed with the pattern '0x1111ada11111'
  ownId = getUserIdFromMatrix(ownId)
  otherUserId = getUserIdFromMatrix(otherUserId)

  return ownId < otherUserId ? `${ownId}_${otherUserId}` : `${otherUserId}_${ownId}`
}

/**
 * Decode friendRequestId from the user IDs involved in the friendship event.
 * The rule is: `ownId` < `otherUserId` ? `ownId_otherUserId` : `otherUserId_ownId`
 * @param friendRequestId
 * @return `otherUserId`
 */
export function decodeFriendRequestId(friendRequestId: string) {
  const firstUserId = friendRequestId.split('_')[0]
  const secondUserId = friendRequestId.split('_')[1]

  return firstUserId < secondUserId ? secondUserId : firstUserId
}
