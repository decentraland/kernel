import { Channel, Conversation, ConversationType, MessageStatus, SearchChannelsResponse, SocialAPI, TextMessage } from "dcl-social-client"
import * as friendsSagas from '../../packages/shared/friends/sagas'
import * as friendsSelectors from 'shared/friends/selectors'
import * as profilesSelectors from 'shared/profiles/selectors'
import { getUserIdFromMatrix } from "shared/friends/utils"
import { buildStore } from "shared/store/store"
import { AddChatMessagesPayload, ChannelInfoPayload, ChannelsInfoPayload, ChatMessageType, GetChannelMessagesPayload, GetChannelsPayload, GetJoinedChannelsPayload, UpdateTotalUnseenMessagesByChannelPayload } from "shared/types"
import sinon from "sinon"
import { getUnityInstance } from "unity-interface/IUnityInterface"
import { Avatar } from "@dcl/schemas"

const channelMessages: TextMessage[] = [
  {
    id: '1',
    timestamp: Date.now(),
    text: 'Hi there, how are you?',
    sender: '@0xa1:decentraland.org',
    status: MessageStatus.READ
  },
  {
    id: '2',
    timestamp: Date.now(),
    text: 'Hi, it is all good',
    sender: '@0xb1:decentraland.org',
    status: MessageStatus.READ
  },
  {
    id: '3',
    timestamp: Date.now(),
    text: 'Hey folks, great over here.',
    sender: '@0xc1:decentraland.org',
    status: MessageStatus.READ
  }
]

const getMockedConversation = (channelId: string, type: ConversationType): Conversation => ({
  type,
  id: channelId,
  lastEventTimestamp: Date.now(),
  userIds: ['0xa1', '0xb1', '0xc1', '0xd1'],
  unreadMessages: [{ id: '1', timestamp: Date.now() }, { id: '2', timestamp: Date.now() }],
  hasMessages: true,
  name: `cantique ${channelId}`,
})

const getMockedChannels = (channelId: string): Channel => ({
  type: ConversationType.CHANNEL,
  id: channelId,
  name: `cantique ${channelId}`,
  description: '',
  memberCount: 0
})

const mutedIds = ['111']

function getMockedAvatar(userId: string, name: string, muted: string[]): Avatar {
  return {
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
    muted: muted,
    name,
    tutorialStep: 1,
    userId,
    version: 1
  }
}

const allCurrentConversations: Array<{ conversation: Conversation; unreadMessages: boolean }> = [
  {
    conversation: getMockedConversation('000', ConversationType.CHANNEL),
    unreadMessages: true
  },
  {
    conversation: getMockedConversation('011', ConversationType.CHANNEL),
    unreadMessages: true
  },
  {
    conversation: getMockedConversation('111', ConversationType.CHANNEL),
    unreadMessages: true
  },
  {
    conversation: getMockedConversation('001', ConversationType.DIRECT),
    unreadMessages: true
  }
]

const publicRooms: SearchChannelsResponse[] = [
  {
    channels: [getMockedChannels('000'), getMockedChannels('111'), getMockedChannels('009')],
    nextBatch: 'next00'
  },
  {
    channels: [getMockedChannels('000'), getMockedChannels('009')],
    nextBatch: undefined
  }
]

const stubClient = (start: number, end: number, index: number) => ({
  getCursorOnMessage: () => Promise.resolve({ getMessages: () => channelMessages.slice(start, end) }),
  searchChannel: () => Promise.resolve(publicRooms[index]),
  getUserId: () => '0xa1',
}) as unknown as SocialAPI

function mockStoreCalls(ops?: { start?: number, end?: number, index?: number }) {
  sinon.stub(friendsSelectors, 'getAllConversationsWithMessages').callsFake(() => allCurrentConversations)
  sinon.stub(friendsSelectors, 'getSocialClient').callsFake(() => stubClient(ops?.start || 0, ops?.end || 0, ops?.index || 0))
  sinon.stub(profilesSelectors, 'getCurrentUserProfile').callsFake(() => getMockedAvatar('0xa1', 'martha', mutedIds) || null)
  sinon.stub(profilesSelectors, 'getProfile').callsFake(() => getMockedAvatar('0xa1', 'martha', mutedIds))
}

describe('Friends sagas - Channels Feature', () => {
  sinon.mock()

  describe('Get user joined channels', () => {
    beforeEach(() => {
      const { store } = buildStore()
      globalThis.globalStore = store

      mockStoreCalls()
    })

    afterEach(() => {
      sinon.restore()
      sinon.reset()
    })

    describe("When the user is joined to channels and there's no skip", () => {
      it('Should send the start of the channel list pagination', () => {
        const request: GetJoinedChannelsPayload = {
          limit: 2,
          skip: 0,
        }

        // parse channel info
        const channelsInfo: ChannelsInfoPayload = {
          channelsInfoPayload: []
        }

        const allCurrentConversationsFiltered = allCurrentConversations.slice(request.skip, request.skip + request.limit).
          filter((conv) => conv.conversation.type === ConversationType.CHANNEL)

        for (const conv of allCurrentConversationsFiltered) {
          channelsInfo.channelsInfoPayload.push({
            name: conv.conversation.name!,
            channelId: conv.conversation.id,
            unseenMessages: conv.conversation.unreadMessages?.length || 0,
            lastMessageTimestamp: conv.conversation.lastEventTimestamp || undefined,
            memberCount: conv.conversation.userIds?.length || 1,
            description: '',
            joined: true,
            muted: false
          })
        }

        sinon.mock(getUnityInstance()).expects('UpdateChannelInfo').once().withExactArgs(channelsInfo)
        friendsSagas.getJoinedChannels(request)
        sinon.mock(getUnityInstance()).verify()
      })
    })

    describe("When the user is joined to channels and there's a skip", () => {
      it('Should filter the channel list to skip the requested amount', () => {
        const request: GetJoinedChannelsPayload = {
          limit: 2,
          skip: 1,
        }

        // parse channel info
        const channelsInfo: ChannelsInfoPayload = {
          channelsInfoPayload: []
        }

        const allCurrentConversationsFiltered = allCurrentConversations.slice(request.skip, request.skip + request.limit).
          filter((conv) => conv.conversation.type === ConversationType.CHANNEL)

        for (const conv of allCurrentConversationsFiltered) {
          channelsInfo.channelsInfoPayload.push({
            name: conv.conversation.name!,
            channelId: conv.conversation.id,
            unseenMessages: conv.conversation.unreadMessages?.length || 0,
            lastMessageTimestamp: conv.conversation.lastEventTimestamp || undefined,
            memberCount: conv.conversation.userIds?.length || 1,
            description: '',
            joined: true,
            muted: false
          })
        }

        sinon.mock(getUnityInstance()).expects('UpdateChannelInfo').once().withExactArgs(channelsInfo)
        friendsSagas.getJoinedChannels(request)
        sinon.mock(getUnityInstance()).verify()
      }
      )
    })
  })

  describe('Get useen messages by channel', () => {
    beforeEach(() => {
      const { store } = buildStore()
      globalThis.globalStore = store

      mockStoreCalls()
    })

    afterEach(() => {
      sinon.restore()
      sinon.reset()
    })

    describe("When the user is joined to channels and some of them have unread messages", () => {
      it('Should send the total amount of unseen messages by channelId', () => {
        const allCurrentConversationsWithMessagesFiltered = allCurrentConversations.
          filter((conv) => conv.conversation.type === ConversationType.CHANNEL && conv.unreadMessages === true)

        const totalUnseenMessagesByChannel: UpdateTotalUnseenMessagesByChannelPayload = {
          unseenChannelMessages: []
        }

        for (const conv of allCurrentConversationsWithMessagesFiltered) {
          totalUnseenMessagesByChannel.unseenChannelMessages.push({
            count: conv.conversation.unreadMessages?.length || 0,
            channelId: conv.conversation.name!
          })
        }

        sinon.mock(getUnityInstance()).expects('UpdateTotalUnseenMessagesByChannel').once().withExactArgs(totalUnseenMessagesByChannel)
        friendsSagas.getUnseenMessagesByChannel()
        sinon.mock(getUnityInstance()).verify()
      })
    })
  })

  describe('Get channel messages', () => {
    let opts = { start: 0, end: 2 }

    beforeEach(() => {
      const { store } = buildStore()
      globalThis.globalStore = store

      mockStoreCalls(opts)
    })

    afterEach(() => {
      opts.end = opts.end + 2
      sinon.restore()
      sinon.reset()
    })

    describe("When the user opens a chat channel window", () => {
      it('Should send the expected messages', () => {
        const request: GetChannelMessagesPayload = {
          channelId: '000',
          limit: 2,
          fromMessageId: ''
        }

        const channelMessagesFiltered = channelMessages.slice(0, 2)

        // parse messages
        const addChatMessagesPayload: AddChatMessagesPayload = {
          messages: channelMessagesFiltered.map((message) => ({
            messageId: message.id,
            messageType: ChatMessageType.PRIVATE,
            timestamp: message.timestamp,
            body: message.text,
            sender: getUserIdFromMatrix(message.sender),
            recipient: request.channelId
          }))
        }

        sinon.mock(getUnityInstance()).expects('AddChatMessages').once().withExactArgs(addChatMessagesPayload)
        friendsSagas.getChannelMessages(request)
        sinon.mock(getUnityInstance()).verify()
      })
    })

    describe("When the user scrolls backwards in a chat channel window", () => {
      it('Should send the expected messages', () => {
        const request: GetChannelMessagesPayload = {
          channelId: '000',
          limit: 2,
          fromMessageId: '2'
        }

        const channelMessagesFiltered = channelMessages.slice(2, 4)

        // parse messages
        const addChatMessagesPayload: AddChatMessagesPayload = {
          messages: channelMessagesFiltered.map((message) => ({
            messageId: message.id,
            messageType: ChatMessageType.PRIVATE,
            timestamp: message.timestamp,
            body: message.text,
            sender: getUserIdFromMatrix(message.sender),
            recipient: request.channelId
          }))
        }

        sinon.mock(getUnityInstance()).expects('AddChatMessages').once().withExactArgs(addChatMessagesPayload)
        friendsSagas.getChannelMessages(request)
        sinon.mock(getUnityInstance()).verify()
      })
    })
  })

  describe('Search channels', () => {
    let opts = { index: 0 }

    beforeEach(() => {
      const { store } = buildStore()
      globalThis.globalStore = store

      mockStoreCalls(opts)
    })

    afterEach(() => {
      opts.index = opts.index + 1
      sinon.restore()
      sinon.reset()
    })

    describe("When the user wanst the list of channel and there's no filter", () => {
      it('Should send the start of the channels list pagination', () => {
        const request: GetChannelsPayload = {
          name: '',
          limit: 3,
          since: undefined
        }

        // parse messages
        const channelsToReturn: ChannelInfoPayload[] = []

        const joinedChannelIds = allCurrentConversations
          .filter((conv) => conv.conversation.type === ConversationType.CHANNEL)
          .map((conv) => conv.conversation.id)

        const { channels, nextBatch } = publicRooms[opts.index]

        for (const channel of channels) {
          let joined = false
          let muted = false

          if (joinedChannelIds.includes(channel.id)) {
            joined = true
          }
          if (mutedIds.includes(channel.id)) {
            muted = true
          }
          channelsToReturn.push({
            name: channel.name!,
            channelId: channel.id,
            unseenMessages: 0,
            lastMessageTimestamp: undefined,
            memberCount: channel.memberCount,
            description: channel.description || '',
            joined,
            muted
          })
        }

        const searchResult = {
          since: nextBatch,
          channels: channelsToReturn
        }

        sinon.mock(getUnityInstance()).expects('UpdateChannelSearchResults').once().withExactArgs({ channelSearchResultsPayload: searchResult })
        friendsSagas.searchChannels(request)
        sinon.mock(getUnityInstance()).verify()
      })
    })

    describe("When the user wanst the list of channel and there's filter", () => {
      it('Should send the start of the filtered channels list pagination', () => {
        const request: GetChannelsPayload = {
          name: '00',
          limit: 3,
          since: undefined
        }

        // parse messages
        const channelsToReturn: ChannelInfoPayload[] = []

        const joinedChannelIds = allCurrentConversations
          .filter((conv) => conv.conversation.type === ConversationType.CHANNEL)
          .map((conv) => conv.conversation.id)

        const { channels, nextBatch } = publicRooms[opts.index]

        for (const channel of channels) {
          let joined = false
          let muted = false

          if (joinedChannelIds.includes(channel.id)) {
            joined = true
          }
          if (mutedIds.includes(channel.id)) {
            muted = true
          }
          channelsToReturn.push({
            name: channel.name!,
            channelId: channel.id,
            unseenMessages: 0,
            lastMessageTimestamp: undefined,
            memberCount: channel.memberCount,
            description: channel.description || '',
            joined,
            muted
          })
        }

        const searchResult = {
          since: nextBatch,
          channels: channelsToReturn
        }

        sinon.mock(getUnityInstance()).expects('UpdateChannelSearchResults').once().withExactArgs({ channelSearchResultsPayload: searchResult })
        friendsSagas.searchChannels(request)
        sinon.mock(getUnityInstance()).verify()
      })
    })
  })
})
