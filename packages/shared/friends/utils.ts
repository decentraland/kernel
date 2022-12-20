import { getFeatureFlagEnabled, getFeatureFlagVariantValue } from 'shared/meta/selectors'
import { RootMetaState } from 'shared/meta/types'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { store } from 'shared/store/isolatedStore'
import { FriendshipAction, UsersAllowed } from 'shared/types'
import { getCoolDownOfFriendRequests, getNumberOfFriendRequests } from './selectors'

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
 * from: '@0x1111ada11111:decentraland.org'
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
 * The rule is: `ownId` < `otherUserId` ? `ownId_otherUserId_requester` : `otherUserId_ownId_requester`
 *
 * If the friend request is incoming and the action is either CANCELED or REQUESTED_FROM or
 * if the friend request is outgoing and the action is either APPROVED or REJECTED,
 * set the requester to the last 4 characters of the otherUserId.
 * Otherwise set the requester to the last 4 characters of the ownId.
 *
 * @param ownId
 * @param otherUserId
 * @param incoming indicates whether the action was incoming (true) or outgoing (false)
 * @param action represents the action being taken
 */
export function encodeFriendRequestId(ownId: string, otherUserId: string, incoming: boolean, action: FriendshipAction) {
  // We always want the friendRequestId to be formed with the pattern '0x1111ada11111'
  ownId = getUserIdFromMatrix(ownId)
  otherUserId = getUserIdFromMatrix(otherUserId)

  let requester = ''

  if (incoming) {
    requester =
      action === FriendshipAction.CANCELED || action === FriendshipAction.REQUESTED_FROM
        ? otherUserId.substring(otherUserId.length - 4)
        : ownId.substring(ownId.length - 4)
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

/**
 * Check whether a user is blocked by the current user
 * @param userId - the ID of the user to check
 * @returns true if the user is blocked, false otherwise
 */
export function isItBlockedUser(userId: string) {
  // Get the user's profile
  const profile = getCurrentUserProfile(store.getState())

  // Check whether the user is blocked
  if (profile?.blocked?.includes(userId)) {
    return true
  }
  return false
}

export const DEFAULT_MAX_NUMBER_OF_REQUESTS = 5

export const COOLDOWN_TIME = 1000 // 1 second

/**
 * Check whether the user has reached the max number of sent requests to a given user
 * @param userId
 * @returns true if the user has reached the max number of sent requests, false otherwise
 */
export function reachedMaxNumberOfRequests(userId: string) {
  // Get number friend requests sent in a session to the given user
  const sentRequests = getNumberOfFriendRequests(store.getState())
  const number = sentRequests.get(userId) ?? 0

  // TODO Juli: Get max number allowed from config or ff
  const maxNumber = DEFAULT_MAX_NUMBER_OF_REQUESTS

  // Check current number vs max number allowed
  if (number < maxNumber) {
    return false
  }
  return true
}

/**
 * Check whether there is a remaining cooldown time to send a friend request to a given user.
 * @param userId
 * @returns true if there is a remaining cooldown time and it hasn't expired yet, false otherwise
 */
export function isRemainingCooldown(userId: string) {
  const currentTime = Date.now()

  // Get the remaining cooldown time for the given user
  const coolDownTimer = getCoolDownOfFriendRequests(store.getState())
  const remainingCooldownTime = coolDownTimer.get(userId)

  // If there is a remaining cooldown time and it hasn't expired yet, return false
  if (remainingCooldownTime && currentTime < remainingCooldownTime) {
    return true
  }
  return false
}
