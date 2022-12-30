import { getFeatureFlagEnabled, getFeatureFlagVariantValue } from 'shared/meta/selectors'
import { RootMetaState } from 'shared/meta/types'
import { store } from 'shared/store/isolatedStore'
import { FriendshipAction, UsersAllowed } from 'shared/types'

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
 *
 * @example
 * from: @0x1111ada11111:decentraland.org'
 * to: '@0x1111ada11111:decentraland.org'
 * */
export function getMatrixIdFromUser(userId: string) {
  const domain = store.getState().friends.client?.getDomain() ?? 'decentraland.org'
  if (userId.startsWith('@') && userId.endsWith(domain)) {
    return userId
  }
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
 * **It is important to send the ownId as the first parameter, otherwise it will cause bugs.**
 * The rule is: `ownId` < `otherUserId` ? `ownId_otherUserId_dispatcher` : `otherUserId_ownId_dispatcher`
 * @param ownId
 * @param otherUserId
 * @param incoming indicates whether the action was incoming (true) or outgoing (false)
 * @param action represents the action being taken
 */
export function encodeFriendRequestId(ownId: string, otherUserId: string, incoming: boolean, action: FriendshipAction) {
  // We always want the friendRequestId to be formed with the pattern '0x1111ada11111'
  ownId = getUserIdFromMatrix(ownId)
  otherUserId = getUserIdFromMatrix(otherUserId)

  // requester is the last 4 characters of the user id of the user who initiated the friendship, that is, sent the friend request
  let requester = ''

  // If the friend request is incoming and the action is either CANCELED or REQUESTED_FROM,
  // set the requester to the last 4 characters of the otherUserId. Otherwise set the requester to the last 4 characters of the ownId
  if (incoming) {
    requester =
      action === FriendshipAction.CANCELED || action === FriendshipAction.REQUESTED_FROM
        ? otherUserId.substring(otherUserId.length - 4)
        : ownId.substring(ownId.length - 4)
    // If the friend request is outgoing and the action is either APPROVED or REJECTED,
    // set the requester to the last 4 characters of the otherUserId. Otherwise set the requester to the last 4 characters of the ownId
  } else {
    requester =
      action === FriendshipAction.APPROVED || action === FriendshipAction.REJECTED
        ? otherUserId.substring(otherUserId.length - 4)
        : ownId.substring(ownId.length - 4)
  }

  return ownId < otherUserId ? `${ownId}_${otherUserId}_${requester}` : `${otherUserId}_${ownId}_${requester}`
}

/**
 * Decode friendRequestId to get otherUserId value.
 * This function should be used only when we are sure that `ownId` is part of `friendRequestId`.
 * @param friendRequestId
 * @param ownId
 * @return `otherUserId`
 */
export function decodeFriendRequestId(friendRequestId: string, ownId: string) {
  // The friendRequestId follows the pattern '0x1111ada11111'
  ownId = getUserIdFromMatrix(ownId)

  // Get index of the ownId
  const index = friendRequestId.indexOf(ownId)

  // Return the id placed in the other index
  if (index === 0) {
    return friendRequestId.split('_')[1]
  } else {
    return friendRequestId.split('_')[0]
  }
}

/**
 * Validate if the `ownId` is part of the `friendRequestId`.
 * @param friendRequestId
 * @param ownId
 */
export function validateFriendRequestId(friendRequestId: string, ownId: string) {
  // The friendRequestId follows the pattern '0x1111ada11111'
  ownId = getUserIdFromMatrix(ownId)

  return friendRequestId.includes(ownId)
}
