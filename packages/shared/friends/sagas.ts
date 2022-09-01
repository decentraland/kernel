import { takeEvery, put, select, call, take, delay, apply, fork, race } from 'redux-saga/effects'

import { Authenticator } from '@dcl/crypto'
import {
  SocialClient,
  FriendshipRequest,
  Conversation,
  PresenceType,
  CurrentUserStatus,
  UnknownUsersError,
  SocialAPI,
  UpdateUserStatus,
  ConversationType
} from 'dcl-social-client'

import { DEBUG_KERNEL_LOG } from 'config'

import { worldToGrid } from 'atomicHelpers/parcelScenePositions'
import { deepEqual } from 'atomicHelpers/deepEqual'

import { createLogger, createDummyLogger } from 'shared/logger'
import {
  ChatMessage,
  NotificationType,
  ChatMessageType,
  FriendshipAction,
  PresenceStatus,
  CreateChannelPayload,
  ChannelErrorPayload,
  UpdateTotalUnseenMessagesByChannelPayload,
  GetJoinedChannelsPayload,
  ChannelsInfoPayload,
  ChannelInfoPayload,
  MarkChannelMessagesAsSeenPayload,
  UpdateTotalUnseenMessagesPayload,
  GetChannelMessagesPayload,
  AddChatMessagesPayload
} from 'shared/types'
import { Realm } from 'shared/dao/types'
import { lastPlayerPosition } from 'shared/world/positionThings'
import { waitForRendererInstance } from 'shared/renderer/sagas-helper'
import { getProfile } from 'shared/profiles/selectors'
import { ExplorerIdentity } from 'shared/session/types'
import { SocialData, FriendsState } from 'shared/friends/types'
import {
  getSocialClient,
  findPrivateMessagingFriendsByUserId,
  getPrivateMessaging,
  getPrivateMessagingFriends,
  getAllConversationsWithMessages
} from 'shared/friends/selectors'
import { USER_AUTHENTIFIED } from 'shared/session/actions'
import { SEND_PRIVATE_MESSAGE, SendPrivateMessage } from 'shared/chat/actions'
import {
  updateFriendship,
  UPDATE_FRIENDSHIP,
  UpdateFriendship,
  updatePrivateMessagingState,
  updateUserData,
  setMatrixClient,
  SET_MATRIX_CLIENT,
  SetMatrixClient,
  JOIN_OR_CREATE_CHANNEL,
  JoinOrCreateChannel
} from 'shared/friends/actions'
import { waitForRealmInitialized } from 'shared/dao/sagas'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { ensureFriendProfile } from './ensureFriendProfile'
import { getFeatureFlagEnabled, getSynapseUrl } from 'shared/meta/selectors'
import { SET_WORLD_CONTEXT } from 'shared/comms/actions'
import { getRealm } from 'shared/comms/selectors'
import { Avatar, EthAddress } from '@dcl/schemas'
import { trackEvent } from '../analytics'
import { getCurrentIdentity, getIsGuestLogin } from 'shared/session/selectors'
import { store } from 'shared/store/isolatedStore'
import { getPeer } from 'shared/comms/peers'
import { waitForMetaConfigurationInitialization } from 'shared/meta/sagas'
import { sleep } from 'atomicHelpers/sleep'
import { CHANNEL_RESERVED_IDS, getUserIdFromMatrix, validateRegexChannelId } from './utils'
import { AuthChain } from '@dcl/kernel-interface/dist/dcl-crypto'

const logger = DEBUG_KERNEL_LOG ? createLogger('chat: ') : createDummyLogger()

const receivedMessages: Record<string, number> = {}

const INITIAL_CHAT_SIZE = 50
const MESSAGE_LIFESPAN_MILLIS = 1_000
const SEND_STATUS_INTERVAL_MILLIS = 60_000
const MIN_TIME_BETWEEN_FRIENDS_INITIALIZATION_RETRIES_MILLIS = 1000
const MAX_TIME_BETWEEN_FRIENDS_INITIALIZATION_RETRIES_MILLIS = 256000

export function* friendsSaga() {
  // We don't want to initialize the friends & chat feature if we are on preview or builder mode
  yield fork(initializeFriendsSaga)
  yield fork(initializeStatusUpdateInterval)
  yield fork(initializeReceivedMessagesCleanUp)

  yield takeEvery(SET_MATRIX_CLIENT, configureMatrixClient)
  yield takeEvery(UPDATE_FRIENDSHIP, trackEvents)
  yield takeEvery(UPDATE_FRIENDSHIP, handleUpdateFriendship)
  yield takeEvery(SEND_PRIVATE_MESSAGE, handleSendPrivateMessage)
  yield takeEvery(JOIN_OR_CREATE_CHANNEL, handleJoinOrCreateChannel)
}

function* initializeFriendsSaga() {
  let secondsToRetry = MIN_TIME_BETWEEN_FRIENDS_INITIALIZATION_RETRIES_MILLIS

  yield call(waitForMetaConfigurationInitialization)

  // this reconnection breaks the server. setting to false
  const shouldRetryReconnection = yield select(getFeatureFlagEnabled, 'retry_matrix_login')
  const chatDisabled = yield select(getFeatureFlagEnabled, 'matrix_disabled')

  if (chatDisabled) return

  do {
    yield race({
      auth: take(USER_AUTHENTIFIED),
      delay: delay(secondsToRetry)
    })

    yield call(waitForRealmInitialized)
    yield call(waitForRendererInstance)

    const currentIdentity: ExplorerIdentity | undefined = yield select(getCurrentIdentity)

    const isGuest = yield select(getIsGuestLogin)

    // guests must not use the friends & private messaging features
    if (isGuest) return

    const client: SocialAPI | null = yield select(getSocialClient)

    try {
      const isLoggedIn: boolean = (currentIdentity && client && (yield apply(client, client.isLoggedIn, []))) || false

      const shouldRetry = !isLoggedIn && !isGuest

      if (shouldRetry) {
        try {
          logger.log('[Social client] Initializing')
          yield call(initializePrivateMessaging)
          logger.log('[Social client] Initialized')
          // restart the debounce
          secondsToRetry = MIN_TIME_BETWEEN_FRIENDS_INITIALIZATION_RETRIES_MILLIS
        } catch (e) {
          logAndTrackError(`Error initializing private messaging`, e)

          if (secondsToRetry < MAX_TIME_BETWEEN_FRIENDS_INITIALIZATION_RETRIES_MILLIS) {
            secondsToRetry *= 1.5
          }
        }
      }
    } catch (e) {
      logAndTrackError('Error while logging in to chat service', e)
    }
  } while (shouldRetryReconnection)
}

async function handleIncomingFriendshipUpdateStatus(action: FriendshipAction, socialId: string) {
  logger.info(`handleIncomingFriendshipUpdateStatus`, action, socialId)

  // map social id to user id
  const userId = parseUserId(socialId)

  if (!userId) {
    logger.warn(`cannot parse user id from social id`, socialId)
    return null
  }

  store.dispatch(updateUserData(userId, socialId))

  // ensure user profile is initialized and send to renderer
  await ensureFriendProfile(userId)

  // add to friendRequests & update renderer
  store.dispatch(updateFriendship(action, userId, true))
}

function* configureMatrixClient(action: SetMatrixClient) {
  const client = action.payload.socialApi
  const identity: ExplorerIdentity | undefined = yield select(getCurrentIdentity)

  const friendsResponse: { friendsSocial: SocialData[]; ownId: string } | undefined = yield call(refreshFriends)

  if (!friendsResponse) {
    // refreshFriends might fail and return with no actual data
    return
  }

  const { friendsSocial, ownId } = friendsResponse

  if (!identity) {
    return
  }

  // initialize conversations
  client.onStatusChange((socialId, status) => {
    const userId = parseUserId(socialId)
    if (userId) {
      sendUpdateUserStatus(userId, status)
    }
  })

  client.onMessage((conversation, message) => {
    if (receivedMessages.hasOwnProperty(message.id)) {
      // message already processed, skipping
      return
    } else {
      receivedMessages[message.id] = Date.now()
    }

    const senderUserId = parseUserId(message.sender)

    if (!senderUserId) {
      logger.error('unknown message', message, conversation)
      return
    }

    const profile = getProfile(store.getState(), identity.address)
    const blocked = profile?.blocked ?? []
    if (blocked.includes(senderUserId)) {
      logger.warn(`got a message from blocked user`, message, conversation)
      return
    }

    const chatMessage = {
      messageId: message.id,
      messageType: ChatMessageType.PRIVATE,
      timestamp: message.timestamp,
      body: message.text,
      sender: message.sender === ownId ? identity.address : senderUserId,
      recipient: message.sender === ownId ? senderUserId : identity.address
    }
    addNewChatMessage(chatMessage)
  })

  client.onFriendshipRequest((socialId) =>
    handleIncomingFriendshipUpdateStatus(FriendshipAction.REQUESTED_FROM, socialId)
  )

  client.onFriendshipRequestCancellation((socialId) =>
    handleIncomingFriendshipUpdateStatus(FriendshipAction.CANCELED, socialId)
  )

  client.onFriendshipRequestApproval(async (socialId) => {
    await handleIncomingFriendshipUpdateStatus(FriendshipAction.APPROVED, socialId)
    updateUserStatus(client, socialId)
  })

  client.onFriendshipDeletion((socialId) => handleIncomingFriendshipUpdateStatus(FriendshipAction.DELETED, socialId))

  client.onFriendshipRequestRejection((socialId) =>
    handleIncomingFriendshipUpdateStatus(FriendshipAction.REJECTED, socialId)
  )

  try {
    const conversations: {
      conversation: Conversation
      unreadMessages: boolean
    }[] = yield client.getAllCurrentConversations()

    yield Promise.all(
      conversations.map(async ({ conversation }) => {
        const cursor = await client.getCursorOnLastMessage(conversation.id, { initialSize: INITIAL_CHAT_SIZE })

        let millisToRetry = MIN_TIME_BETWEEN_FRIENDS_INITIALIZATION_RETRIES_MILLIS

        const maxAttempts = 5
        let shouldTry = true
        let attempt = 0

        while (shouldTry) {
          attempt += 1

          try {
            const messages = cursor.getMessages()

            const friend = friendsSocial.find((friend) => friend.conversationId === conversation.id)

            if (!friend) {
              return
            }

            messages.forEach((message) => {
              const chatMessage = {
                messageId: message.id,
                messageType: ChatMessageType.PRIVATE,
                timestamp: message.timestamp,
                body: message.text,
                sender: message.sender === ownId ? identity.address : friend.userId,
                recipient: message.sender === ownId ? friend.userId : identity.address
              }
              addNewChatMessage(chatMessage)
            })

            shouldTry = false
          } catch (e) {
            logAndTrackError(`There was an error fetching messages for conversation, attempt ${attempt}`, e)

            if (millisToRetry < MAX_TIME_BETWEEN_FRIENDS_INITIALIZATION_RETRIES_MILLIS) {
              millisToRetry *= 2
            }

            shouldTry = attempt < maxAttempts

            if (shouldTry) {
              await sleep(millisToRetry)
            } else {
              logAndTrackError(
                `Error fetching message for conversation, maxed attempts to try (${maxAttempts}), will no retry`,
                e
              )
            }
          }
        }
      })
    )
  } catch (e) {
    logAndTrackError('Error while initializing chat messages', e)
  }
}

// this saga needs to throw in case of failure
function* initializePrivateMessaging() {
  const synapseUrl: string = yield select(getSynapseUrl)
  const identity: ExplorerIdentity | undefined = yield select(getCurrentIdentity)

  if (!identity) return

  const { address: ethAddress } = identity
  const timestamp: number = Date.now()

  // TODO: the "timestamp" should be a message also signed by a catalyst.
  const messageToSign = `${timestamp}`

  const authChain = Authenticator.signPayload(identity, messageToSign)

  const disablePresence = yield select(getFeatureFlagEnabled, 'matrix_presence_disabled')

  const client: SocialAPI = yield apply(SocialClient, SocialClient.loginToServer, [
    synapseUrl,
    ethAddress,
    timestamp,
    authChain as AuthChain,
    {
      disablePresence
    }
  ])

  yield put(setMatrixClient(client))
}

function* refreshFriends() {
  try {
    const client: SocialAPI | null = yield select(getSocialClient)

    if (!client) return

    const ownId = client.getUserId()

    // init friends
    const friends: string[] = yield client.getAllFriends()

    const friendsSocial: SocialData[] = yield Promise.all(
      // TODO: opening the conversations should be a reactive thing
      // and should only happen after you click in a conversation from the UI
      // also, the UI should show a bubble whenever the matrix client recevies
      // an invitation to join to a room.
      // then the room should be created in renderer and start the conversation that way, after the click
      toSocialData(friends).map(async (friend) => {
        const conversation = await client.createDirectConversation(friend.socialId)
        return { ...friend, conversationId: conversation.id }
      })
    )

    // init friend requests
    const friendRequests: FriendshipRequest[] = yield client.getPendingRequests()

    // filter my requests to others
    const toFriendRequests = friendRequests.filter((request) => request.from === ownId).map((request) => request.to)
    const toFriendRequestsSocial = toSocialData(toFriendRequests)

    // filter other requests to me
    const fromFriendRequests = friendRequests.filter((request) => request.to === ownId).map((request) => request.from)
    const fromFriendRequestsSocial = toSocialData(fromFriendRequests)

    const socialInfo: Record<string, SocialData> = [
      ...friendsSocial,
      ...toFriendRequestsSocial,
      ...fromFriendRequestsSocial
    ].reduce(
      (acc, current) => ({
        ...acc,
        [current.socialId]: current
      }),
      {}
    )

    const friendIds = friends.map(($) => parseUserId($)).filter(Boolean) as string[]
    const requestedFromIds = fromFriendRequestsSocial.map(($) => $.userId)
    const requestedToIds = toFriendRequestsSocial.map(($) => $.userId)

    yield put(
      updatePrivateMessagingState({
        client,
        socialInfo,
        friends: friendIds,
        fromFriendRequests: requestedFromIds,
        toFriendRequests: requestedToIds
      })
    )

    // ensure friend profiles are sent to renderer

    yield Promise.all(Object.values(socialInfo).map(({ userId }) => ensureFriendProfile(userId))).catch(logger.error)

    const initMessage = {
      currentFriends: friendIds,
      requestedTo: requestedToIds,
      requestedFrom: requestedFromIds
    }

    getUnityInstance().InitializeFriends(initMessage)

    return { friendsSocial, ownId }
  } catch (e) {
    logAndTrackError('Error while refreshing friends', e)
  }
}

function* initializeReceivedMessagesCleanUp() {
  while (true) {
    yield delay(MESSAGE_LIFESPAN_MILLIS)
    const now = Date.now()

    Object.entries(receivedMessages)
      .filter(([, timestamp]) => now - timestamp > MESSAGE_LIFESPAN_MILLIS)
      .forEach(([id]) => delete receivedMessages[id])
  }
}

function isPeerAvatarAvailable(userId: string) {
  return !!getPeer(userId.toLowerCase())
}

function sendUpdateUserStatus(id: string, status: CurrentUserStatus) {
  const userId = parseUserId(id)

  if (!userId) return

  // treat 'unavailable' status as 'online'
  const isOnline = isPeerAvatarAvailable(userId) || status.presence !== PresenceType.OFFLINE

  const updateMessage = {
    userId,
    realm: status.realm,
    position: status.position,
    presence: isOnline ? PresenceStatus.ONLINE : PresenceStatus.OFFLINE
  }

  getUnityInstance().UpdateUserPresence(updateMessage)
}

function updateUserStatus(client: SocialAPI, ...socialIds: string[]) {
  const statuses = client.getUserStatuses(...socialIds)

  statuses.forEach((value, key) => {
    sendUpdateUserStatus(key, value)
  })
}

function* initializeStatusUpdateInterval() {
  let lastStatus: UpdateUserStatus | undefined = undefined

  while (true) {
    yield race({
      SET_MATRIX_CLIENT: take(SET_MATRIX_CLIENT),
      SET_WORLD_CONTEXT: take(SET_WORLD_CONTEXT),
      timeout: delay(SEND_STATUS_INTERVAL_MILLIS)
    })

    const client: SocialAPI | null = yield select(getSocialClient)
    const realm: Realm | null = yield select(getRealm)

    if (!client || !realm) {
      continue
    }

    const domain = client.getDomain()

    const rawFriends: string[] = yield select(getPrivateMessagingFriends)

    const friends = rawFriends.map((x) => {
      return `@${x}:${domain}`
    })

    updateUserStatus(client, ...friends)

    const position = worldToGrid(lastPlayerPosition.clone())

    const updateStatus: UpdateUserStatus = {
      realm: {
        layer: '',
        serverName: realm.serverName
      },
      position,
      presence: PresenceType.ONLINE
    }

    const shouldSendNewStatus = !deepEqual(updateStatus, lastStatus)

    if (shouldSendNewStatus) {
      logger.log('Sending new comms status', updateStatus)
      client.setStatus(updateStatus).catch((e) => logger.error(`error while setting status`, e))
      lastStatus = updateStatus
    }
  }
}

/**
 * The social id for the time being should always be of the form `@ethAddress:server`
 *
 * @param socialId a string with the aforementioned pattern
 */
function parseUserId(socialId: string) {
  if (EthAddress.validate(socialId) as any) return socialId
  const result = socialId.match(/@(\w+):.*/)
  if (!result || result.length < 2) {
    logger.warn(`Could not match social id with ethereum address, this should not happen`)
    return null
  }
  return result[1]
}

function addNewChatMessage(chatMessage: ChatMessage) {
  getUnityInstance().AddMessageToChatWindow(chatMessage)
}

function* handleSendPrivateMessage(action: SendPrivateMessage) {
  const { message, userId } = action.payload

  const client: SocialAPI | null = yield select(getSocialClient)

  if (!client) {
    logger.error(`Social client should be initialized by now`)
    return
  }

  const userData: ReturnType<typeof findPrivateMessagingFriendsByUserId> = yield select(
    findPrivateMessagingFriendsByUserId,
    userId
  )

  if (!userData) {
    logger.error(`User not found ${userId}`)
    return
  }

  try {
    const conversation: Conversation = yield apply(client, client.createDirectConversation, [userData.socialId])
    yield apply(client, client.sendMessageTo, [conversation.id, message])
  } catch (e: any) {
    logger.error(e)
    trackEvent('error', {
      context: 'handleSendPrivateMessage',
      message: e.message,
      stack: e.stack,
      saga_stack: e.toString()
    })
  }
}

function* handleUpdateFriendship({ payload, meta }: UpdateFriendship) {
  const { action, userId } = payload

  const client: SocialAPI | undefined = yield select(getSocialClient)

  if (!client) {
    return
  }

  try {
    const { incoming } = meta

    const state: ReturnType<typeof getPrivateMessaging> = yield select(getPrivateMessaging)

    let newState: FriendsState | undefined

    const socialData: SocialData | undefined = yield select(findPrivateMessagingFriendsByUserId, userId)

    if (socialData) {
      try {
        yield apply(client, client.createDirectConversation, [socialData.socialId])
      } catch (e) {
        logAndTrackError('Error while creating direct conversation for friendship', e)
        return
      }
    } else {
      // if this is the case, a previous call to ensure data load is missing, this is an issue on our end
      logger.error(`handleUpdateFriendship, user not loaded`, userId)
      return
    }

    switch (action) {
      case FriendshipAction.NONE: {
        // do nothing
        break
      }
      case FriendshipAction.APPROVED:
      case FriendshipAction.REJECTED: {
        const selector = incoming ? 'toFriendRequests' : 'fromFriendRequests'
        const requests = [...state[selector]]

        const index = requests.indexOf(userId)

        logger.info(`requests[${selector}]`, requests, index, userId)
        if (index !== -1) {
          requests.splice(index, 1)

          newState = { ...state, [selector]: requests }

          if (action === FriendshipAction.APPROVED && !state.friends.includes(userId)) {
            newState.friends.push(userId)

            const socialData: SocialData = yield select(findPrivateMessagingFriendsByUserId, userId)
            try {
              const conversation: Conversation = yield client.createDirectConversation(socialData.socialId)

              logger.info(`userData`, userId, socialData.socialId, conversation.id)
              newState.socialInfo[userId] = { userId, socialId: socialData.socialId, conversationId: conversation.id }
            } catch (e) {
              logAndTrackError('Error while approving/rejecting friendship', e)
            }
          }
        }

        break
      }
      case FriendshipAction.CANCELED: {
        const selector = incoming ? 'fromFriendRequests' : 'toFriendRequests'
        const requests = [...state[selector]]

        const index = requests.indexOf(userId)

        if (index !== -1) {
          requests.splice(index, 1)

          newState = { ...state, [selector]: requests }
        }

        break
      }
      case FriendshipAction.REQUESTED_FROM: {
        const exists = state.fromFriendRequests.includes(userId)

        if (!exists) {
          newState = { ...state, fromFriendRequests: [...state.fromFriendRequests, userId] }
        }

        break
      }
      case FriendshipAction.REQUESTED_TO: {
        const exists = state.toFriendRequests.includes(userId)

        if (!exists) {
          newState = { ...state, toFriendRequests: [...state.toFriendRequests, userId] }
        }

        break
      }
      case FriendshipAction.DELETED: {
        const index = state.friends.indexOf(userId)

        if (index !== -1) {
          const friends = [...state.friends]
          friends.splice(index, 1)

          newState = { ...state, friends }
        }

        break
      }
    }

    if (newState) {
      yield put(updatePrivateMessagingState(newState))

      if (incoming) {
        yield call(waitForRendererInstance)
        getUnityInstance().UpdateFriendshipStatus(payload)
      } else {
        yield call(handleOutgoingUpdateFriendshipStatus, payload)
      }
    }

    if (!incoming) {
      // refresh self & renderer friends status if update was triggered by renderer
      yield call(refreshFriends)
    }
  } catch (e) {
    if (e instanceof UnknownUsersError) {
      const profile: Avatar = yield call(ensureFriendProfile, userId)
      const id = profile?.name ? profile.name : `with address '${userId}'`
      showErrorNotification(`User ${id} must log in at least once before befriending them`)
    }

    // in case of any error, re initialize friends, to possibly correct state in both kernel and renderer
    yield call(refreshFriends)
  }
}

function* trackEvents({ payload }: UpdateFriendship) {
  const { action } = payload
  switch (action) {
    case FriendshipAction.APPROVED: {
      trackEvent('Control Friend request approved', {})
      break
    }
    case FriendshipAction.REJECTED: {
      trackEvent('Control Friend request rejected', {})
      break
    }
    case FriendshipAction.CANCELED: {
      trackEvent('Control Friend request cancelled', {})
      break
    }
    case FriendshipAction.REQUESTED_FROM: {
      trackEvent('Control Friend request received', {})
      break
    }
    case FriendshipAction.REQUESTED_TO: {
      trackEvent('Control Friend request sent', {})
      break
    }
    case FriendshipAction.DELETED: {
      trackEvent('Control Friend deleted', {})
      break
    }
  }
}

function showErrorNotification(message: string) {
  getUnityInstance().ShowNotification({
    type: NotificationType.GENERIC,
    message,
    buttonMessage: 'OK',
    timer: 5
  })
}

function* handleOutgoingUpdateFriendshipStatus(update: UpdateFriendship['payload']) {
  const client: SocialAPI | undefined = yield select(getSocialClient)
  const socialData: SocialData = yield select(findPrivateMessagingFriendsByUserId, update.userId)

  if (!client) {
    return
  }

  if (!socialData) {
    logger.error(`could not find social data for`, update.userId)
    return
  }

  const { socialId } = socialData

  try {
    switch (update.action) {
      case FriendshipAction.NONE: {
        // do nothing in this case
        break
      }
      case FriendshipAction.APPROVED: {
        yield client.approveFriendshipRequestFrom(socialId)
        updateUserStatus(client, socialId)
        break
      }
      case FriendshipAction.REJECTED: {
        yield client.rejectFriendshipRequestFrom(socialId)
        break
      }
      case FriendshipAction.CANCELED: {
        yield client.cancelFriendshipRequestTo(socialId)
        break
      }
      case FriendshipAction.REQUESTED_FROM: {
        // do nothing in this case
        break
      }
      case FriendshipAction.REQUESTED_TO: {
        yield client.addAsFriend(socialId)
        break
      }
      case FriendshipAction.DELETED: {
        yield client.deleteFriendshipWith(socialId)
        break
      }
    }
  } catch (e) {
    logAndTrackError('error while acting user friendship action', e)
  }

  // wait for matrix server to process new status
  yield delay(500)
}

function toSocialData(socialIds: string[]) {
  return socialIds
    .map((socialId) => ({
      userId: parseUserId(socialId),
      socialId
    }))
    .filter(({ userId }) => !!userId) as SocialData[]
}

function logAndTrackError(message: string, e: any) {
  logger.error(message, e)

  trackEvent('error', {
    context: 'kernel#saga',
    message: message,
    stack: '' + e
  })
}

// Join or create channel
async function* handleJoinOrCreateChannel(action: JoinOrCreateChannel) {
  const client: SocialAPI | null = getSocialClient(store.getState())
  if (!client) return

  const channelId = action.payload.channelId
  const ownId = client.getUserId()

  // get or create channel
  const { created, conversation } = await client.getOrCreateChannel(channelId, [ownId])

  const channel: ChannelInfoPayload = {
    name: conversation.name!,
    channelId: conversation.id,
    unseenMessages: 0,
    lastMessageTimestamp: undefined,
    memberCount: 1,
    description: '',
    joined: true,
    muted: false
  }

  if (!created) {
    await client.joinChannel(conversation.id)

    const joinedChannel = client.getChannel(conversation.id)

    channel.unseenMessages = joinedChannel?.unreadMessages?.length || 0
    channel.lastMessageTimestamp = joinedChannel?.lastEventTimestamp
    channel.memberCount = joinedChannel?.userIds?.length || 0
  }

  // parse channel info
  const channelsInfo: ChannelsInfoPayload = {
    channelsInfoPayload: [channel]
  }

  // send confirmation message to unity
  getUnityInstance().JoinChannelConfirmation(channelsInfo)
}

// Create channel
export async function createChannel(request: CreateChannelPayload) {
  const client: SocialAPI | null = getSocialClient(store.getState())
  if (!client) return

  const channelId = request.channelId
  const ownId = client.getUserId()

  if (CHANNEL_RESERVED_IDS.includes(channelId)) {
    joinChannelError(channelId, 'Reserved name')
    return
  }

  if (!validateRegexChannelId(channelId)) {
    joinChannelError(channelId, 'Bad regex')
    return
  }

  // create channel
  const { created, conversation } = await client.getOrCreateChannel(channelId, [ownId])

  if (!created) {
    joinChannelError(channelId, 'Already exists')
    return
  }

  // parse channel info
  const channelsInfo: ChannelsInfoPayload = {
    channelsInfoPayload: [
      {
        name: conversation.name!,
        channelId: conversation.id,
        unseenMessages: 0,
        lastMessageTimestamp: undefined,
        memberCount: 1,
        description: '',
        joined: true,
        muted: false
      }
    ]
  }

  // Send confirmation message to unity
  getUnityInstance().JoinChannelConfirmation(channelsInfo)
}

// Get unseen messages by channel
export function getUnseenMessagesByChannel() {
  // get conversations messages
  const updateTotalUnseenMessagesByChannelPayload: UpdateTotalUnseenMessagesByChannelPayload =
    getTotalUnseenMessagesByChannel()

  // send total unseen messages by channels to unity
  getUnityInstance().UpdateTotalUnseenMessagesByChannel(updateTotalUnseenMessagesByChannelPayload)
}

// Get user's joined channels
export function getJoinedChannels(request: GetJoinedChannelsPayload) {
  // get conversations messages from the store
  const conversationsWithMessages = getAllConversationsWithMessages(store.getState()).filter(
    (conv) => conv.conversation.type === ConversationType.CHANNEL
  )

  conversationsWithMessages.slice(request.skip, request.skip + request.limit)

  // parse channel info
  const channelsInfo: ChannelsInfoPayload = {
    channelsInfoPayload: []
  }

  for (const conv of conversationsWithMessages) {
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

  // send total unseen messages by channels to unity
  getUnityInstance().UpdateChannelInfo(channelsInfo)
}

// Mark channel messages as seen
export async function markAsSeenChannelMessages(request: MarkChannelMessagesAsSeenPayload) {
  const client: SocialAPI | null = getSocialClient(store.getState())
  if (!client) return

  // get user's chat unread messages
  const unreadMessages = client.getConversationUnreadMessages(request.channelId).length

  if (unreadMessages > 0) {
    // mark as seen all the messages in the conversation
    await client.markMessagesAsSeen(request.channelId)
  }

  // get total user unread messages
  const totalUnreadMessages = client.getTotalUnseenMessages()
  const updateTotalUnseenMessages: UpdateTotalUnseenMessagesPayload = {
    total: totalUnreadMessages
  }

  // get total unseen messages by channel
  const updateTotalUnseenMessagesByChannel: UpdateTotalUnseenMessagesByChannelPayload =
    getTotalUnseenMessagesByChannel()

  getUnityInstance().UpdateTotalUnseenMessagesByChannel(updateTotalUnseenMessagesByChannel)
  getUnityInstance().UpdateTotalUnseenMessages(updateTotalUnseenMessages)
}

// Get channel messages
export async function getChannelMessages(getChannelMessagesPayload: GetChannelMessagesPayload) {
  const client: SocialAPI | null = getSocialClient(store.getState())
  if (!client) return

  const ownId = client.getUserId()

  // get cursor of the conversation located on the given message or at the end of the conversation if there is no given message.
  const messageId: string | undefined = !getChannelMessagesPayload.fromMessageId
    ? undefined
    : getChannelMessagesPayload.fromMessageId

  // the message in question is in the middle of a window, so we multiply by two the limit in order to get the required messages.
  let limit = getChannelMessagesPayload.limit
  if (messageId !== undefined) {
    limit = limit * 2
  }

  const cursorMessage = await client.getCursorOnMessage(getChannelMessagesPayload.channelId, messageId, {
    initialSize: limit,
    limit
  })

  const messages = cursorMessage.getMessages()
  if (messageId !== undefined) {
    // we remove the messages they already have.
    const index = messages.map((messages) => messages.id).indexOf(messageId)
    messages.splice(index)
  }

  // parse messages
  const addChatMessages: AddChatMessagesPayload = {
    messages: messages.map((message) => ({
      messageId: message.id,
      messageType: ChatMessageType.PRIVATE,
      timestamp: message.timestamp,
      body: message.text,
      sender: getUserIdFromMatrix(message.sender),
      recipient: message.sender === ownId ? '' : getUserIdFromMatrix(ownId) // Todo Juli!: what should we send? check with explorer
    }))
  }

  getUnityInstance().AddChatMessages(addChatMessages)
}

/**
 * Send error message to unity
 * @param channelId
 * @param message
 */
function joinChannelError(channelId: string, message: string) {
  const joinChannelError: ChannelErrorPayload = {
    channelId: channelId,
    message: message
  }

  // send error message to unity
  getUnityInstance().JoinChannelError(joinChannelError)
}

/**
 * Get list of total unseen messages by channelId
 */
function getTotalUnseenMessagesByChannel() {
  // get conversations messages
  const conversationsWithMessages = getAllConversationsWithMessages(store.getState()).filter(
    (conv) => conv.conversation.type === ConversationType.CHANNEL
  )

  const updateTotalUnseenMessagesByChannelPayload: UpdateTotalUnseenMessagesByChannelPayload = {
    unseenChannelMessages: []
  }

  // it means the user is not joined to any channel
  if (conversationsWithMessages.length === 0) {
    return updateTotalUnseenMessagesByChannelPayload
  }

  for (const conv of conversationsWithMessages) {
    updateTotalUnseenMessagesByChannelPayload.unseenChannelMessages.push({
      count: conv.conversation.unreadMessages?.length || 0,
      channelId: conv.conversation.name!
    })
  }

  return updateTotalUnseenMessagesByChannelPayload
}
