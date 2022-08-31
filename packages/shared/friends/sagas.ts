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
  UpdateUserStatus
} from 'dcl-social-client'

import { DEBUG_KERNEL_LOG } from 'config'

import { worldToGrid } from 'atomicHelpers/parcelScenePositions'
import { deepEqual } from 'atomicHelpers/deepEqual'

import defaultLogger, { createLogger, createDummyLogger } from 'shared/logger'
import {
  ChatMessage,
  NotificationType,
  ChatMessageType,
  FriendshipAction,
  PresenceStatus,
  FriendsInitializationMessage,
  GetFriendsPayload,
  AddFriendsPayload,
  GetFriendRequestsPayload,
  AddFriendRequestsPayload,
  UpdateUserUnseenMessagesPayload,
  UpdateTotalUnseenMessagesPayload,
  AddChatMessagesPayload,
  GetFriendsWithDirectMessagesPayload,
  AddFriendsWithDirectMessagesPayload,
  UpdateTotalUnseenMessagesByUserPayload,
  UpdateTotalFriendRequestsPayload,
  FriendsInitializeChatPayload,
  MarkMessagesAsSeenPayload,
  GetPrivateMessagesPayload
} from 'shared/types'
import { Realm } from 'shared/dao/types'
import { lastPlayerPosition } from 'shared/world/positionThings'
import { waitForRendererInstance } from 'shared/renderer/sagas-helper'
import { getProfile, getProfilesFromStore, isAddedToCatalog } from 'shared/profiles/selectors'
import { ExplorerIdentity } from 'shared/session/types'
import { SocialData, FriendsState, FriendRequest } from 'shared/friends/types'
import {
  getSocialClient,
  findPrivateMessagingFriendsByUserId,
  getPrivateMessaging,
  getPrivateMessagingFriends,
  getAllConversationsWithMessages,
  getTotalFriendRequests,
  getTotalFriends,
  isFriend
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
  SetMatrixClient
} from 'shared/friends/actions'
import { waitForRealmInitialized } from 'shared/dao/sagas'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { ensureFriendProfile, ensureFriendsProfile } from './ensureFriendProfile'
import { getFeatureFlagEnabled, getSynapseUrl } from 'shared/meta/selectors'
import { SET_WORLD_CONTEXT } from 'shared/comms/actions'
import { getRealm } from 'shared/comms/selectors'
import { Avatar, EthAddress } from '@dcl/schemas'
import { trackEvent } from '../analytics'
import { getCurrentIdentity, getIsGuestLogin } from 'shared/session/selectors'
import { store } from 'shared/store/isolatedStore'
import { getPeer } from 'shared/comms/peers'
import { waitForMetaConfigurationInitialization } from 'shared/meta/sagas'
import { ProfileUserInfo } from 'shared/profiles/types'
import { profileToRendererFormat } from 'shared/profiles/transformations/profileToRendererFormat'
import { addedProfilesToCatalog } from 'shared/profiles/actions'
import { getUserIdFromMatrix, getMatrixIdFromUser } from './utils'
import { AuthChain } from '@dcl/kernel-interface/dist/dcl-crypto'

const logger = DEBUG_KERNEL_LOG ? createLogger('chat: ') : createDummyLogger()

const receivedMessages: Record<string, number> = {}

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

  const { ownId } = friendsResponse

  if (!identity) {
    return
  }

  // initialize conversations
  client.onStatusChange(async (socialId, status) => {
    const userId = parseUserId(socialId)
    if (userId) {
      // When it's a friend and is not added to catalog
      // unity needs to know this information to show that the user has connected
      if (isFriend(store.getState(), userId) && !isAddedToCatalog(store.getState(), userId)) {
        await ensureFriendProfile(userId)
        getUnityInstance().AddFriends({
          friends: [userId],
          totalFriends: getTotalFriends(store.getState())
        })
      }

      sendUpdateUserStatus(userId, status)
    }
  })

  client.onMessage(async (conversation, message) => {
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

    let userProfile = getProfile(store.getState(), senderUserId)
    if (!userProfile || !isAddedToCatalog(store.getState(), senderUserId)) {
      await ensureFriendProfile(senderUserId)
    }

    addNewChatMessage(chatMessage)

    // get total user unread messages
    if (message.sender !== ownId) {
      const totalUnreadMessages = getTotalUnseenMessages(client, ownId, getFriendIds(client))
      const unreadMessages = client.getConversationUnreadMessages(conversation.id).length

      const updateUnseenMessages: UpdateUserUnseenMessagesPayload = {
        userId: senderUserId,
        total: unreadMessages
      }
      const updateTotalUnseenMessages: UpdateTotalUnseenMessagesPayload = {
        total: totalUnreadMessages
      }

      getUnityInstance().UpdateUserUnseenMessages(updateUnseenMessages)
      getUnityInstance().UpdateTotalUnseenMessages(updateTotalUnseenMessages)
    }
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
    const friendIds: string[] = yield getFriendIds(client)
    const friendsSocial: SocialData[] = []

    // init friend requests
    const friendRequests: FriendshipRequest[] = yield client.getPendingRequests()

    // filter my requests to others
    const toFriendRequests = friendRequests.filter((request) => request.from === ownId)
    const toFriendRequestsIds = toFriendRequests.map((request) => request.to)
    const toFriendRequestsSocial = toSocialData(toFriendRequestsIds)

    // filter other requests to me
    const fromFriendRequests = friendRequests.filter((request) => request.to === ownId)
    const fromFriendRequestsIds = fromFriendRequests.map((request) => request.from)
    const fromFriendRequestsSocial = toSocialData(fromFriendRequestsIds)

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

    const requestedFromIds = fromFriendRequests.map(
      (request): FriendRequest => ({
        createdAt: request.createdAt,
        userId: getUserIdFromMatrix(request.from)
      })
    )
    const requestedToIds = toFriendRequests.map(
      (request): FriendRequest => ({
        createdAt: request.createdAt,
        userId: getUserIdFromMatrix(request.to)
      })
    )

    // explorer information
    const totalUnseenMessages = getTotalUnseenMessages(client, ownId, friendIds)

    const initFriendsMessage: FriendsInitializationMessage = {
      totalReceivedRequests: requestedFromIds.length
    }
    const initChatMessage: FriendsInitializeChatPayload = {
      totalUnseenMessages
    }

    defaultLogger.log('____ initMessage ____', initFriendsMessage)
    defaultLogger.log('____ initChatMessage ____', initChatMessage)

    getUnityInstance().InitializeFriends(initFriendsMessage)
    getUnityInstance().InitializeChat(initChatMessage)

    const allProfilesToObtain = friendIds
      .concat(requestedFromIds.map((x) => x.userId))
      .concat(requestedToIds.map((x) => x.userId))

    yield ensureFriendsProfile(allProfilesToObtain).catch(logger.error)

    yield put(
      updatePrivateMessagingState({
        client,
        socialInfo,
        friends: friendIds,
        fromFriendRequests: requestedFromIds,
        toFriendRequests: requestedToIds
      })
    )

    return { friendsSocial, ownId }
  } catch (e) {
    logAndTrackError('Error while refreshing friends', e)
  }
}

function getFriendIds(client: SocialAPI): string[] {
  const friends: string[] = client.getAllFriends()

  return friends.map(($) => parseUserId($)).filter(Boolean) as string[]
}

function getTotalUnseenMessages(client: SocialAPI, ownId: string, friendIds: string[]): number {
  const conversationsWithUnreadMessages: Conversation[] = client.getAllConversationsWithUnreadMessages()

  let totalUnseenMessages = 0

  for (const conv of conversationsWithUnreadMessages) {
    const socialId = conv.userIds?.find((userId) => userId !== ownId)
    if (!socialId) {
      continue
    }

    const userId = getUserIdFromMatrix(socialId)

    if (!friendIds.some((friendIds) => friendIds === userId)) {
      continue
    }

    totalUnseenMessages += conv.unreadMessages?.length || 0
  }

  return totalUnseenMessages
}

export function getFriends(request: GetFriendsPayload) {
  // ensure friend profiles are sent to renderer

  const friendsIds: string[] = getPrivateMessagingFriends(store.getState())

  const filteredFriends: Array<ProfileUserInfo> = getProfilesFromStore(
    store.getState(),
    friendsIds,
    request.userNameOrId
  )

  const friendsToReturn = filteredFriends.slice(request.skip, request.skip + request.limit)

  const profilesForRenderer = friendsToReturn.map((profile) => profileToRendererFormat(profile.data, {}))
  getUnityInstance().AddUserProfilesToCatalog({ users: profilesForRenderer })

  const friendIdsToReturn = friendsToReturn.map((friend) => friend.data.userId)

  const addFriendsPayload: AddFriendsPayload = {
    friends: friendIdsToReturn,
    totalFriends: friendsIds.length
  }

  getUnityInstance().AddFriends(addFriendsPayload)

  store.dispatch(addedProfilesToCatalog(friendsToReturn.map((friend) => friend.data)))

  const client = getSocialClient(store.getState())
  if (!client) {
    return
  }

  const friendsSocialIds = friendIdsToReturn.map(getMatrixIdFromUser)
  updateUserStatus(client, ...friendsSocialIds)
}

export function getFriendRequests(request: GetFriendRequestsPayload) {
  const friends: FriendsState = getPrivateMessaging(store.getState())

  const fromFriendRequests = friends.fromFriendRequests.slice(
    request.receivedSkip,
    request.receivedSkip + request.receivedLimit
  )
  const toFriendRequests = friends.toFriendRequests.slice(request.sentSkip, request.sentSkip + request.sentLimit)

  const addFriendRequestsPayload: AddFriendRequestsPayload = {
    requestedTo: toFriendRequests.map((friend) => friend.userId),
    requestedFrom: fromFriendRequests.map((friend) => friend.userId),
    totalReceivedFriendRequests: fromFriendRequests.length,
    totalSentFriendRequests: toFriendRequests.length
  }

  // get friend requests profiles
  const friendsIds = addFriendRequestsPayload.requestedTo.concat(addFriendRequestsPayload.requestedFrom)
  const friendRequestsProfiles: ProfileUserInfo[] = getProfilesFromStore(store.getState(), friendsIds)
  const profilesForRenderer = friendRequestsProfiles.map((friend) => profileToRendererFormat(friend.data, {}))

  // send friend requests profiles
  getUnityInstance().AddUserProfilesToCatalog({ users: profilesForRenderer })
  store.dispatch(addedProfilesToCatalog(friendRequestsProfiles.map((friend) => friend.data)))

  // send friend requests
  getUnityInstance().AddFriendRequests(addFriendRequestsPayload)
}

export async function markAsSeenPrivateChatMessages(userId: MarkMessagesAsSeenPayload) {
  const client: SocialAPI | null = getSocialClient(store.getState())
  if (!client) return

  // get conversation id
  const conversationId = await getConversationId(client, userId.userId)

  // get user's chat unread messages
  const unreadMessages = client.getConversationUnreadMessages(conversationId).length

  if (unreadMessages > 0) {
    // mark as seen all the messages in the conversation
    await client.markMessagesAsSeen(conversationId)
  }

  // get total user unread messages
  const totalUnreadMessages = getTotalUnseenMessages(client, client.getUserId(), getFriendIds(client))

  const updateUnseenMessages: UpdateUserUnseenMessagesPayload = {
    userId: userId.userId,
    total: 0
  }
  const updateTotalUnseenMessages: UpdateTotalUnseenMessagesPayload = {
    total: totalUnreadMessages
  }

  getUnityInstance().UpdateUserUnseenMessages(updateUnseenMessages)
  getUnityInstance().UpdateTotalUnseenMessages(updateTotalUnseenMessages)
}

export async function getPrivateMessages(getPrivateMessagesPayload: GetPrivateMessagesPayload) {
  const client: SocialAPI | null = getSocialClient(store.getState())
  if (!client) return

  // get the conversation.id
  const conversationId = await getConversationId(client, getPrivateMessagesPayload.userId)

  const ownId = client.getUserId()

  // get cursor of the conversation located on the given message or at the end of the conversation if there is no given message.
  const messageId: string | undefined = !getPrivateMessagesPayload.fromMessageId
    ? undefined
    : getPrivateMessagesPayload.fromMessageId

  // the message in question is in the middle of a window, so we multiply by two the limit in order to get the required messages.
  let limit = getPrivateMessagesPayload.limit
  if (messageId !== undefined) {
    limit = limit * 2
  }

  const cursorMessage = await client.getCursorOnMessage(conversationId, messageId, {
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
  const addChatMessagesPayload: AddChatMessagesPayload = {
    messages: messages.map((message) => ({
      messageId: message.id,
      messageType: ChatMessageType.PRIVATE,
      timestamp: message.timestamp,
      body: message.text,
      sender: message.sender === ownId ? getUserIdFromMatrix(ownId) : getPrivateMessagesPayload.userId,
      recipient: message.sender === ownId ? getPrivateMessagesPayload.userId : getUserIdFromMatrix(ownId)
    }))
  }

  getUnityInstance().AddChatMessages(addChatMessagesPayload)
}

export function getUnseenMessagesByUser() {
  const conversationsWithMessages = getAllConversationsWithMessages(store.getState())

  if (conversationsWithMessages.length === 0) {
    return
  }

  const updateTotalUnseenMessagesByUserPayload: UpdateTotalUnseenMessagesByUserPayload = { unseenPrivateMessages: [] }

  for (const conversation of conversationsWithMessages) {
    updateTotalUnseenMessagesByUserPayload.unseenPrivateMessages.push({
      count: conversation.conversation.unreadMessages?.length || 0,
      userId: conversation.conversation.userIds![1]
    })
  }

  getUnityInstance().UpdateTotalUnseenMessagesByUser(updateTotalUnseenMessagesByUserPayload)
}

export function getFriendsWithDirectMessages(request: GetFriendsWithDirectMessagesPayload) {
  const conversationsWithMessages = getAllConversationsWithMessages(store.getState())

  if (conversationsWithMessages.length === 0) {
    return
  }

  const friendsIds: string[] = getPrivateMessagingFriends(store.getState()).slice(
    request.skip,
    request.skip + request.limit
  )
  const filteredFriends: Array<ProfileUserInfo> = getProfilesFromStore(
    store.getState(),
    friendsIds,
    request.userNameOrId
  )

  const friendsConversations: Array<{ userId: string; conversation: Conversation; avatar: Avatar }> = []

  for (const friend of filteredFriends) {
    const conversation = conversationsWithMessages.find((conv) => conv.conversation.userIds![1] === friend.data.userId)

    if (conversation) {
      friendsConversations.push({
        userId: friend.data.userId,
        conversation: conversation.conversation,
        avatar: friend.data
      })
    }
  }

  const addFriendsWithDirectMessagesPayload: AddFriendsWithDirectMessagesPayload = {
    currentFriendsWithDirectMessages: friendsConversations.map((friend) => ({
      lastMessageTimestamp: friend.conversation.lastEventTimestamp!,
      userId: friend.userId
    })),
    totalFriendsWithDirectMessages: friendsConversations.length
  }

  const profilesForRenderer = friendsConversations.map((friend) => profileToRendererFormat(friend.avatar, {}))

  getUnityInstance().AddUserProfilesToCatalog({ users: profilesForRenderer })
  store.dispatch(addedProfilesToCatalog(friendsConversations.map((friend) => friend.avatar)))

  getUnityInstance().AddFriendsWithDirectMessages(addFriendsWithDirectMessagesPayload)

  const client = getSocialClient(store.getState())
  if (!client) {
    return
  }

  const friendsSocialIds = filteredFriends.map((friend) => getMatrixIdFromUser(friend.data.userId))
  updateUserStatus(client, ...friendsSocialIds)
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

  statuses.forEach((value: CurrentUserStatus, key: string) => {
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

    const incoming = meta.incoming
    const hasSentFriendshipRequest = state.toFriendRequests.some((request) => request.userId === userId)

    const friendRequestTypeSelector = hasSentFriendshipRequest ? 'toFriendRequests' : 'fromFriendRequests'
    const updateTotalFriendRequestsPayloadSelector: keyof UpdateTotalFriendRequestsPayload = hasSentFriendshipRequest
      ? 'totalSentRequests'
      : 'totalReceivedRequests'

    let updateTotalFriendRequestsPayload: UpdateTotalFriendRequestsPayload = yield select(getTotalFriendRequests)
    let totalFriends: number = yield select(getTotalFriends)

    switch (action) {
      case FriendshipAction.NONE: {
        // do nothing
        break
      }
      case FriendshipAction.APPROVED: {
        totalFriends += 1
      }
      // The approved should not have a break since it should execute all the code as the rejected case
      // Also the rejected needs to be directly after the Approved to make sure this works
      case FriendshipAction.REJECTED: {
        const requests = [...state[friendRequestTypeSelector]]

        const index = requests.findIndex((request) => request.userId === userId)

        logger.info(`requests[${friendRequestTypeSelector}]`, requests, index, userId)
        if (index !== -1) {
          requests.splice(index, 1)

          newState = { ...state, [friendRequestTypeSelector]: requests }

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

        updateTotalFriendRequestsPayload = {
          ...updateTotalFriendRequestsPayload,
          [updateTotalFriendRequestsPayloadSelector]:
            updateTotalFriendRequestsPayload[updateTotalFriendRequestsPayloadSelector] - 1
        }

        break
      }

      case FriendshipAction.CANCELED: {
        const requests = [...state[friendRequestTypeSelector]]

        const index = requests.findIndex((request) => request.userId === userId)

        if (index !== -1) {
          requests.splice(index, 1)

          newState = { ...state, [friendRequestTypeSelector]: requests }
        }

        updateTotalFriendRequestsPayload = {
          ...updateTotalFriendRequestsPayload,
          [updateTotalFriendRequestsPayloadSelector]:
            updateTotalFriendRequestsPayload[updateTotalFriendRequestsPayloadSelector] - 1
        }

        break
      }
      case FriendshipAction.REQUESTED_FROM: {
        const request = state.fromFriendRequests.find((request) => request.userId === userId)

        if (!request) {
          newState = {
            ...state,
            fromFriendRequests: [...state.fromFriendRequests, { createdAt: Date.now(), userId }]
          }
        }

        updateTotalFriendRequestsPayload = {
          ...updateTotalFriendRequestsPayload,
          totalReceivedRequests: updateTotalFriendRequestsPayload.totalReceivedRequests + 1
        }

        break
      }
      case FriendshipAction.REQUESTED_TO: {
        const request = state.toFriendRequests.find((request) => request.userId === userId)

        if (!request) {
          newState = {
            ...state,
            toFriendRequests: [...state.toFriendRequests, { createdAt: Date.now(), userId }]
          }
        }

        updateTotalFriendRequestsPayload = {
          ...updateTotalFriendRequestsPayload,
          totalSentRequests: updateTotalFriendRequestsPayload.totalSentRequests + 1
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

        totalFriends -= 1

        break
      }
    }

    getUnityInstance().UpdateTotalFriendRequests(updateTotalFriendRequestsPayload)
    getUnityInstance().UpdateTotalFriends({
      totalFriends
    })

    if (newState) {
      yield put(updatePrivateMessagingState(newState))

      if (incoming) {
        yield call(waitForRendererInstance)
      } else {
        yield call(handleOutgoingUpdateFriendshipStatus, payload)
      }

      getUnityInstance().UpdateFriendshipStatus(payload)
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
        // this action should never happen
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

/**
 * Get the conversation id from the store when possible.
 * If not, then fetch it from matrix and update the private messaging state
 * @param client SocialAPI client
 * @param userId a string with the userId pattern
 */
async function getConversationId(client: SocialAPI, userId: string) {
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
 * Update the social info from the private messaging state
 * @param socialData the social data to add to the record.
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
