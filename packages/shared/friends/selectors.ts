import { Conversation } from 'dcl-social-client'
import { UpdateTotalFriendRequestsPayload } from 'shared/types'
import { RootFriendsState } from './types'
import { getUserIdFromMatrixId } from './utils'

export const getSocialClient = (store: RootFriendsState) => store.friends.client
export const getAllConversationsWithMessages = (
  store: RootFriendsState
): Array<{ conversation: Conversation; unreadMessages: boolean }> => {
  const client = getSocialClient(store)
  if (!client) return []

  const conversations = client.getAllCurrentConversations()

  return conversations
    .filter((conv) => conv.conversation.hasMessages)
    .map((conv) => ({
      ...conv,
      conversation: {
        ...conv.conversation,
        userIds: conv.conversation.userIds?.map((userId) => getUserIdFromMatrixId(userId))
      }
    }))
}

export const getTotalFriendRequests = (store: RootFriendsState): UpdateTotalFriendRequestsPayload => ({
  totalReceivedRequests: store.friends.fromFriendRequests.length,
  totalSentRequests: store.friends.toFriendRequests.length
})

export const getTotalFriends = (store: RootFriendsState): number => store.friends.friends.length

export const getPrivateMessaging = (store: RootFriendsState) => store.friends
export const getPrivateMessagingFriends = (store: RootFriendsState): string[] => store.friends?.friends || []

export const findPrivateMessagingFriendsByUserId = (store: RootFriendsState, userId: string) =>
  Object.values(store.friends.socialInfo).find((socialData) => socialData.userId === userId)

export const isFriend = (store: RootFriendsState, userId: string) => store.friends.friends.includes(userId)
