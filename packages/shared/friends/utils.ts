import { store } from 'shared/store/isolatedStore'

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
 * The channel name should always match with the regex: ^[a-zA-Z0-9-]{3,20}$
 * @param channelId a string with the channelId to validate
 * */
export function validateRegexChannelId(channelId: string) {
  const regex = /^[a-zA-Z0-9-]{3,20}$/

  if (channelId.match(regex)) return true

  return false
}

export const CHANNEL_RESERVED_IDS = ['nearby']
