import { buildStore } from 'shared/store/store'
import {
  AddChatMessagesPayload,
  ChatMessageType,
  AddFriendsWithDirectMessagesPayload,
  GetFriendRequestsPayload,
  GetFriendsPayload,
  GetFriendsWithDirectMessagesPayload,
  GetPrivateMessagesPayload
} from 'shared/types'
import sinon from 'sinon'
import * as friendsSagas from '../../packages/shared/friends/sagas'
import * as friendsSelectors from 'shared/friends/selectors'
import * as profilesSelectors from 'shared/profiles/selectors'
import { ProfileUserInfo } from 'shared/profiles/types'
import { getUnityInstance } from '../../packages/unity-interface/IUnityInterface'
import { profileToRendererFormat } from 'shared/profiles/transformations/profileToRendererFormat'
import { FriendRequest, FriendsState } from 'shared/friends/types'
import { Conversation, ConversationType, MessageStatus, SocialAPI, TextMessage } from 'dcl-social-client'
import { AddUserProfilesToCatalogPayload } from 'shared/profiles/transformations/types'
import * as daoSelectors from 'shared/dao/selectors'

function getMockedAvatar(userId: string, name: string): ProfileUserInfo {
  return {
    data: {
      avatar: {
        snapshots: {
          face256: '',
          body: ''
        },
        eyes: { color: '' },
        hair: { color: '' },
        skin: { color: '' }
      } as any,
      description: '',
      ethAddress: userId,
      hasClaimedName: false,
      name,
      tutorialStep: 1,
      userId,
      version: 1
    },
    status: 'ok'
  }
}

const textMessages: TextMessage[] = [
  {
    id: '1',
    timestamp: Date.now(),
    text: 'Hi there, how are you?',
    sender: '0xa2',
    status: MessageStatus.READ
  },
  {
    id: '2',
    timestamp: Date.now(),
    text: 'Hi, it is all good',
    sender: '0xa3',
    status: MessageStatus.READ
  }
]

const friendIds = ['0xa1', '0xb1', '0xc1', '0xd1']

const fromFriendRequest: FriendRequest = {
  userId: '0xa1',
  createdAt: 123123132
}

const toFriendRequest: FriendRequest = {
  userId: '0xa2',
  createdAt: 123123132
}

const friendsFromStore: FriendsState = {
  client: null,
  socialInfo: {},
  friends: [],
  fromFriendRequests: [fromFriendRequest],
  toFriendRequests: [toFriendRequest],
  lastStatusOfFriends: new Map()
}

const profilesFromStore = [
  getMockedAvatar('0xa1', 'john'),
  getMockedAvatar('0xa2', 'mike'),
  getMockedAvatar('0xc1', 'agus'),
  getMockedAvatar('0xd1', 'boris')
]

const getMockedConversation = (userIds: string[]): Conversation => ({
  type: ConversationType.DIRECT,
  id: userIds.join('-'),
  userIds,
  lastEventTimestamp: Date.now(),
  hasMessages: true
})

const allCurrentConversations: Array<{ conversation: Conversation; unreadMessages: boolean }> = [
  {
    conversation: getMockedConversation([profilesFromStore[0].data.userId, profilesFromStore[1].data.userId]),
    unreadMessages: false
  },
  {
    conversation: getMockedConversation([profilesFromStore[0].data.userId, profilesFromStore[2].data.userId]),
    unreadMessages: false
  },
  {
    conversation: getMockedConversation([profilesFromStore[0].data.userId, profilesFromStore[3].data.userId]),
    unreadMessages: false
  }
]

const stubClient = {
  getAllCurrentConversations: () => allCurrentConversations,
  getCursorOnMessage: () => Promise.resolve({ getMessages: () => textMessages }),
  getUserId: () => '0xa2',
  createDirectConversation: () => allCurrentConversations[0].conversation,
  getUserStatuses: () => new Map()
} as unknown as SocialAPI

const FETCH_CONTENT_SERVER = 'base-url'

function mockStoreCalls(opts?: { profiles: number[]; i: number }) {
  sinon.stub(daoSelectors, 'getFetchContentUrlPrefix').callsFake(() => FETCH_CONTENT_SERVER)
  sinon.stub(friendsSelectors, 'getPrivateMessagingFriends').callsFake(() => friendIds)
  sinon.stub(friendsSelectors, 'getPrivateMessaging').callsFake(() => friendsFromStore)
  sinon
    .stub(profilesSelectors, 'getProfilesFromStore')
    .callsFake((_, _userIds, userNameOrId) =>
      profilesSelectors.filterProfilesByUserNameOrId(profilesFromStore.slice(0, opts?.profiles[opts.i]), userNameOrId)
    )
  sinon.stub(friendsSelectors, 'getSocialClient').callsFake(() => stubClient)
}

describe('Friends sagas', () => {
  sinon.mock()

  describe('get friends', () => {
    beforeEach(() => {
      const { store } = buildStore()
      globalThis.globalStore = store

      mockStoreCalls()
    })

    afterEach(() => {
      sinon.restore()
      sinon.reset()
    })

    describe("When there's a filter by id", () => {
      it('Should filter the responses to have only the ones that include the userId and have the full friends length as total', () => {
        const request: GetFriendsPayload = {
          limit: 1000,
          skip: 0,
          userNameOrId: '0xa'
        }
        const expectedFriends: AddUserProfilesToCatalogPayload = {
          users: [
            profileToRendererFormat(profilesFromStore[0].data, {baseUrl: FETCH_CONTENT_SERVER}),
            profileToRendererFormat(profilesFromStore[1].data, {baseUrl: FETCH_CONTENT_SERVER})
          ]
        }
        const addedFriends = {
          friends: expectedFriends.users.map((friend) => friend.userId),
          totalFriends: profilesFromStore.length
        }

        sinon.mock(getUnityInstance()).expects('AddUserProfilesToCatalog').once().withExactArgs(expectedFriends)
        sinon.mock(getUnityInstance()).expects('AddFriends').once().withExactArgs(addedFriends)
        friendsSagas.getFriends(request)
        sinon.mock(getUnityInstance()).verify()
      })
    })

    describe("When there's a filter by name", () => {
      it('Should filter the responses to have only the ones that include the user name and have the full friends length as total', () => {
        const request2: GetFriendsPayload = {
          limit: 1000,
          skip: 0,
          userNameOrId: 'MiKe'
        }
        const expectedFriends: AddUserProfilesToCatalogPayload = {
          users: [profileToRendererFormat(profilesFromStore[1].data, {baseUrl: FETCH_CONTENT_SERVER})]
        }
        const addedFriends = {
          friends: expectedFriends.users.map((friend) => friend.userId),
          totalFriends: profilesFromStore.length
        }
        sinon.mock(getUnityInstance()).expects('AddUserProfilesToCatalog').once().withExactArgs(expectedFriends)
        sinon.mock(getUnityInstance()).expects('AddFriends').once().withExactArgs(addedFriends)
        friendsSagas.getFriends(request2)
        sinon.mock(getUnityInstance()).verify()
      })
    })

    describe("When there's a skip", () => {
      it('Should filter the responses to skip the expected amount', () => {
        const request2: GetFriendsPayload = {
          limit: 1000,
          skip: 1
        }
        const expectedFriends: AddUserProfilesToCatalogPayload = {
          users: profilesFromStore.slice(1).map((profile) => profileToRendererFormat(profile.data, {baseUrl: FETCH_CONTENT_SERVER}))
        }
        const addedFriends = {
          friends: expectedFriends.users.map((friend) => friend.userId),
          totalFriends: 4
        }
        sinon.mock(getUnityInstance()).expects('AddUserProfilesToCatalog').once().withExactArgs(expectedFriends)
        sinon.mock(getUnityInstance()).expects('AddFriends').once().withExactArgs(addedFriends)
        friendsSagas.getFriends(request2)
        sinon.mock(getUnityInstance()).verify()
      })
    })
  })

  describe('get friend requests', () => {
    let opts = {
      profiles: [2, 0],
      i: 0
    }

    beforeEach(() => {
      const { store } = buildStore()
      globalThis.globalStore = store

      mockStoreCalls(opts)
    })

    afterEach(() => {
      opts.i = +1
      sinon.restore()
      sinon.reset()
    })

    describe("When there're sent and received friend requests", () => {
      it('Should call unity with the declared parameters', () => {
        const request: GetFriendRequestsPayload = {
          sentLimit: 10,
          sentSkip: 0,
          receivedLimit: 10,
          receivedSkip: 0
        }

        const addedFriendRequests = {
          requestedTo: friendsFromStore.toFriendRequests.map((friend) => friend.userId),
          requestedFrom: friendsFromStore.fromFriendRequests.map((friend) => friend.userId),
          totalReceivedFriendRequests: friendsFromStore.fromFriendRequests.length,
          totalSentFriendRequests: friendsFromStore.toFriendRequests.length
        }

        const expectedFriends: AddUserProfilesToCatalogPayload = {
          users: [
            profileToRendererFormat(profilesFromStore[0].data, {baseUrl: FETCH_CONTENT_SERVER}),
            profileToRendererFormat(profilesFromStore[1].data, {baseUrl: FETCH_CONTENT_SERVER})
          ]
        }

        sinon.mock(getUnityInstance()).expects('AddUserProfilesToCatalog').once().withExactArgs(expectedFriends)
        sinon.mock(getUnityInstance()).expects('AddFriendRequests').once().withExactArgs(addedFriendRequests)
        friendsSagas.getFriendRequests(request)
        sinon.mock(getUnityInstance()).verify()
      })
    })

    describe("When there're friend requests, but there's also a skip", () => {
      it('Should filter the requests to skip the expected amount', () => {
        const request: GetFriendRequestsPayload = {
          sentLimit: 10,
          sentSkip: 5,
          receivedLimit: 10,
          receivedSkip: 5
        }

        const addedFriendRequests = {
          requestedTo: friendsFromStore.toFriendRequests.slice(5).map((friend) => friend.userId),
          requestedFrom: friendsFromStore.fromFriendRequests.slice(5).map((friend) => friend.userId),
          totalReceivedFriendRequests: friendsFromStore.fromFriendRequests.length,
          totalSentFriendRequests: friendsFromStore.toFriendRequests.length
        }

        const expectedFriends: AddUserProfilesToCatalogPayload = {
          users: profilesFromStore.slice(5).map((profile) => profileToRendererFormat(profile.data, {baseUrl: FETCH_CONTENT_SERVER}))
        }

        sinon.mock(getUnityInstance()).expects('AddUserProfilesToCatalog').once().withExactArgs(expectedFriends)
        sinon.mock(getUnityInstance()).expects('AddFriendRequests').once().withExactArgs(addedFriendRequests)
        friendsSagas.getFriendRequests(request)
        sinon.mock(getUnityInstance()).verify()
      })
    })
  })

  describe('getFriendsWithDirectMessages', () => {
    describe("when there's a client", () => {
      beforeEach(() => {
        const { store } = buildStore()
        globalThis.globalStore = store

        mockStoreCalls()
      })

      afterEach(() => {
        sinon.restore()
        sinon.reset()
      })

      it('Should send unity the expected profiles and the expected friend conversations', () => {
        const request: GetFriendsWithDirectMessagesPayload = {
          limit: 1000,
          skip: 0,
          userNameOrId: '0xa' // this will only bring the friend 0xa2
        }
        const expectedFriends: AddUserProfilesToCatalogPayload = {
          users: [profileToRendererFormat(profilesFromStore[1].data, {baseUrl: FETCH_CONTENT_SERVER})]
        }

        const expectedAddFriendsWithDirectMessagesPayload: AddFriendsWithDirectMessagesPayload = {
          currentFriendsWithDirectMessages: [
            {
              lastMessageTimestamp: allCurrentConversations[0].conversation.lastEventTimestamp!,
              userId: profilesFromStore[1].data.userId
            }
          ],
          totalFriendsWithDirectMessages: allCurrentConversations.length
        }

        sinon.mock(getUnityInstance()).expects('AddUserProfilesToCatalog').once().withExactArgs(expectedFriends)
        sinon
          .mock(getUnityInstance())
          .expects('AddFriendsWithDirectMessages')
          .once()
          .withExactArgs(expectedAddFriendsWithDirectMessagesPayload)
        friendsSagas.getFriendsWithDirectMessages(request)
        sinon.mock(getUnityInstance()).verify()
      })
    })
  })

  describe('get private messages from specific chat', () => {
    describe('When a private chat is opened', () => {
      beforeEach(() => {
        const { store } = buildStore()
        globalThis.globalStore = store

        mockStoreCalls()
      })

      afterEach(() => {
        sinon.restore()
        sinon.reset()
      })

      it('Should call unity with the expected private messages', () => {
        const request: GetPrivateMessagesPayload = {
          userId: '0xa3',
          limit: 10,
          fromMessageId: ''
        }

        // parse messages
        const addChatMessagesPayload: AddChatMessagesPayload = {
          messages: textMessages.map((message) => ({
            messageId: message.id,
            messageType: ChatMessageType.PRIVATE,
            timestamp: message.timestamp,
            body: message.text,
            sender: message.sender === '0xa2' ? '0xa2' : request.userId,
            recipient: message.sender === '0xa2' ? request.userId : '0xa2'
          }))
        }

        sinon.mock(getUnityInstance()).expects('AddMessageToChatWindow').once().withExactArgs(addChatMessagesPayload)
        friendsSagas.getPrivateMessages(request)
        sinon.mock(getUnityInstance()).verify()
      })
    })
  })
})
