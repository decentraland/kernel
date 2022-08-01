import { buildStore } from 'shared/store/store'
import { AddChatMessagesPayload, ChatMessageType, GetFriendRequestsPayload, GetFriendsPayload } from 'shared/types'
import sinon from 'sinon'
import * as friendsSagas from '../../packages/shared/friends/sagas'
import * as friendsSelectors from 'shared/friends/selectors'
import * as profilesSelectors from 'shared/profiles/selectors'
import { ProfileUserInfo } from 'shared/profiles/types'
import { getUnityInstance } from '../../packages/unity-interface/IUnityInterface'
import { profileToRendererFormat } from 'shared/profiles/transformations/profileToRendererFormat'
import { FriendRequest, FriendsState, SocialData } from 'shared/friends/types'
import { MessageStatus, SocialAPI, TextMessage } from 'dcl-social-client'

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
      userId: userId,
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
  socialInfo: null,
  friends: [],
  fromFriendRequests: [fromFriendRequest],
  toFriendRequests: [toFriendRequest]
}

const profilesFromStore = [
  getMockedAvatar('0xa1', 'john'),
  getMockedAvatar('0xa2', 'mike'),
  getMockedAvatar('0xc1', 'agus'),
  getMockedAvatar('0xd1', 'boris')
]

const socialData: SocialData = {
  userId: '0xa2',
  socialId: '0xa2',
  conversationId: '0xa2-0xa3'
}

const client = {
  getCursorOnMessage: () => Promise.resolve({ getMessages: () => textMessages }),
  getUserId: () => '0xa2'
} as unknown as SocialAPI

function mockStoreCalls() {
  sinon.stub(friendsSelectors, 'getPrivateMessagingFriends').callsFake(() => friendIds)
  sinon.stub(friendsSelectors, 'getPrivateMessaging').callsFake(() => friendsFromStore)
  sinon.stub(profilesSelectors, 'getProfilesFromStore').callsFake(() => profilesFromStore)
  sinon.stub(friendsSelectors, 'getSocialClient').callsFake(() => client)
  sinon.stub(friendsSelectors, 'findPrivateMessagingFriendsByUserId').callsFake(() => socialData)
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
      it('Should filter the responses to have only the ones that include the userId', () => {
        const request: GetFriendsPayload = {
          limit: 1000,
          skip: 0,
          userNameOrId: '0xa'
        }
        const expectedFriends = [
          profileToRendererFormat(profilesFromStore[0].data, {}),
          profileToRendererFormat(profilesFromStore[1].data, {})
        ]
        const addedFriends = {
          friends: expectedFriends.map((friend) => friend.userId),
          totalFriends: 2
        }

        sinon.mock(getUnityInstance()).expects('AddUserProfilesToCatalog').once().withExactArgs(expectedFriends)
        sinon.mock(getUnityInstance()).expects('AddFriends').once().withExactArgs(addedFriends)
        friendsSagas.getFriends(request)
        sinon.verify()
      })
    })

    describe("When there's a filter by name", () => {
      it('Should filter the responses to have only the ones that include the user name', () => {
        const request2: GetFriendsPayload = {
          limit: 1000,
          skip: 0,
          userNameOrId: 'MiKe'
        }
        const expectedFriends = [profileToRendererFormat(profilesFromStore[1].data, {})]
        const addedFriends = {
          friends: expectedFriends.map((friend) => friend.userId),
          totalFriends: 1
        }
        sinon.mock(getUnityInstance()).expects('AddUserProfilesToCatalog').once().withExactArgs(expectedFriends)
        sinon.mock(getUnityInstance()).expects('AddFriends').once().withExactArgs(addedFriends)
        friendsSagas.getFriends(request2)
        sinon.verify()
      })
    })

    describe("When there's a skip", () => {
      it('Should filter the responses to skip the expected amount', () => {
        const request2: GetFriendsPayload = {
          limit: 1000,
          skip: 1
        }
        const expectedFriends = profilesFromStore.slice(1).map((profile) => profileToRendererFormat(profile.data, {}))
        const addedFriends = {
          friends: expectedFriends.map((friend) => friend.userId),
          totalFriends: 4
        }
        sinon.mock(getUnityInstance()).expects('AddUserProfilesToCatalog').once().withExactArgs(expectedFriends)
        sinon.mock(getUnityInstance()).expects('AddFriends').once().withExactArgs(addedFriends)
        friendsSagas.getFriends(request2)
        sinon.verify()
      })
    })
  })

  describe('get friend requests', () => {
    beforeEach(() => {
      const { store } = buildStore()
      globalThis.globalStore = store

      mockStoreCalls()
    })

    afterEach(() => {
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
          totalReceivedFriendRequests: 1,
          totalSentFriendRequests: 1
        }

        sinon.mock(getUnityInstance()).expects('AddFriendRequests').once().withExactArgs(addedFriendRequests)
        friendsSagas.getFriendRequests(request)
        sinon.verify()
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
          totalReceivedFriendRequests: 0,
          totalSentFriendRequests: 0
        }

        sinon.mock(getUnityInstance()).expects('AddFriendRequests').once().withExactArgs(addedFriendRequests)
        friendsSagas.getFriendRequests(request)
        sinon.verify()
      })
    })
  })

  describe('get private messages from specific chat', () => {
    beforeEach(() => {
      const { store } = buildStore()
      globalThis.globalStore = store

      mockStoreCalls()
    })

    afterEach(() => {
      sinon.restore()
      sinon.reset()
    })

    describe("When a private chat is opened", () => {
      it('Should call unity with the expected private messages', () => {
        const request = {
          userId: '0xa3',
          limit: 10,
          from: '0',
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
        friendsSagas.getPrivateMessages(request.userId, request.limit, request.from)
        sinon.mock(getUnityInstance()).verify()
      })
    })
  })
})
