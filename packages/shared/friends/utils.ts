import { put } from 'redux-saga/effects'
import { updatePrivateMessagingState } from './actions'
import { findPrivateMessagingFriendsByUserId, getPrivateMessaging } from './selectors'
import { FriendsState, SocialData } from './types'
import { store } from 'shared/store/isolatedStore'
import { Conversation, SocialAPI } from 'dcl-social-client'

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
 *
 */
export async function getConversationId(client: SocialAPI, userId: string) {
  let conversationId = findPrivateMessagingFriendsByUserId(store.getState(), userId)?.conversationId

  if (!conversationId) {
    const socialId = getMatrixIdFromUser(userId)
    const conversation: Conversation = await client.createDirectConversation(socialId)

    const socialData: SocialData = {
      userId: userId,
      socialId: socialId,
      conversationId: conversation.id
    }

    updateSocialInfo(socialData)
    conversationId = conversation.id
  }

  return conversationId
}

/**
 * Get the matrixUserId from userId
 * @param userId a string with the userId pattern
 *
 * @example
 * from: '0x1111ada11111'
 * to: '@0x1111ada11111:decentraland.org'
 * */
function getMatrixIdFromUser(userId: string) {
  // TODO check how'd be the correct way to do this
  return '@' + userId.toString() + ':decentraland.org'
}

/**
 *
 */
function updateSocialInfo(socialData: SocialData) {
  const friends: FriendsState = getPrivateMessaging(store.getState())

  // add social info
  friends.socialInfo[socialData.socialId] = socialData

  put(
    updatePrivateMessagingState({
      client: friends.client,
      socialInfo: friends.socialInfo,
      friends: friends.friends,
      fromFriendRequests: friends.fromFriendRequests,
      toFriendRequests: friends.toFriendRequests
    })
  )
}
