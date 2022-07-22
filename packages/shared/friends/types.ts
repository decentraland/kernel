import { SocialAPI } from 'dcl-social-client'
export type SocialData = {
  userId: string
  socialId: string
  conversationId?: string
}

export interface FriendRequest {
  userId: string
  createdAt: number
}

export type FriendsState = {
  client: SocialAPI | null
  socialInfo: Record<string, SocialData>
  friends: string[]
  /**
   * Outgoing requests. Friend requests from the current player to others.
   *
   * The current player has sent a request to become friends with another.
   * If said request doesn't exist, it should be created.
   * If a request to the current player exists, the request should be removed and the player added as a friend.
   */
  toFriendRequests: FriendRequest[]
  /**
   * Incoming requests. Friend requets from other players to the current one.
   *
   * A player has sent a request to become friends with the current player.
   * If said request doesn't exist, it should be created.
   * If a request to the player exists, the request should be removed and the player added as a friend.
   */
  fromFriendRequests: FriendRequest[]
}

export type RootFriendsState = {
  friends: FriendsState
}
