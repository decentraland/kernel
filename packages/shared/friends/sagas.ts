import { takeEvery, put, select, call, take, delay, apply, fork, race } from 'redux-saga/effects'

import { Authenticator } from 'dcl-crypto'
import {
  SocialClient,
  FriendshipRequest,
  Conversation,
  PresenceType,
  CurrentUserStatus,
  UnknownUsersError,
  UserPosition,
  SocialAPI,
  Realm as SocialRealm,
  UpdateUserStatus
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
  UpdateUserStatusMessage
} from 'shared/types'
import { Realm } from 'shared/dao/types'
import { lastPlayerPosition } from 'shared/world/positionThings'
import { waitForRendererInstance } from 'shared/renderer/sagas'
import { ADDED_PROFILE_TO_CATALOG } from 'shared/profiles/actions'
import { isAddedToCatalog, getProfile } from 'shared/profiles/selectors'
import { ExplorerIdentity } from 'shared/session/types'
import { SocialData, FriendsState } from 'shared/friends/types'
import {
  getSocialClient,
  findPrivateMessagingFriendsByUserId,
  getPrivateMessaging,
  getPrivateMessagingFriends
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
import { ensureFriendProfile } from './ensureFriendProfile'
import { getSynapseUrl } from 'shared/meta/selectors'
import { notifyStatusThroughChat } from 'shared/chat'
import { SET_WORLD_CONTEXT } from 'shared/comms/actions'
import { getRealm } from 'shared/comms/selectors'
import { Avatar, EthAddress } from '@dcl/schemas'
import { trackEvent } from '../analytics'
import { getCurrentIdentity } from 'shared/session/selectors'
import { store } from 'shared/store/isolatedStore'

const logger = DEBUG_KERNEL_LOG ? createLogger('chat: ') : createDummyLogger()

const INITIAL_CHAT_SIZE = 50

const receivedMessages: Record<string, number> = {}
const MESSAGE_LIFESPAN_MILLIS = 1000

const SEND_STATUS_INTERVAL_MILLIS = 5000
type PresenceMemoization = { realm: SocialRealm | undefined; position: UserPosition | undefined }
const presenceMap: Record<string, PresenceMemoization | undefined> = {}

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

  while (true) {
    yield race({
      auth: take(USER_AUTHENTIFIED),
      delay: delay(secondsToRetry)
    })

    yield call(waitForRealmInitialized)
    yield call(waitForRendererInstance)

    const currentIdentity: ExplorerIdentity | undefined = yield select(getCurrentIdentity)
    const client: SocialAPI | null = yield select(getSocialClient)
    const isLoggedIn: boolean = (currentIdentity && client && (yield apply(client, client.isLoggedIn, []))) || false

    const shouldRetry = !isLoggedIn

    if (shouldRetry) {
      try {
        logger.log('[Social client] Initializing')
        yield call(initializePrivateMessaging)
        logger.log('[Social client] Initialized')
        // restart the debounce
        secondsToRetry = MIN_TIME_BETWEEN_FRIENDS_INITIALIZATION_RETRIES_MILLIS
      } catch (e) {
        logger.error(`Error initializing private messaging`, e)

        trackEvent('error', {
          context: 'kernel#saga',
          message: 'There was an error initializing friends and private messages',
          stack: '' + e
        })

        if (secondsToRetry < MAX_TIME_BETWEEN_FRIENDS_INITIALIZATION_RETRIES_MILLIS) {
          secondsToRetry *= 1.5
        }
      }
    }
  }
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

  const { friendsSocial, ownId }: { friendsSocial: SocialData[]; ownId: string } = yield call(refreshFriends)

  if (!identity) {
    return
  }

  // initialize conversations
  client.onStatusChange((socialId, status) => {
    logger.info(`client.onStatusChange`, socialId, status)
    const user: SocialData | undefined = findPrivateMessagingFriendsByUserId(store.getState(), socialId)

    if (!user) {
      logger.error(`user not found for status change with social id`, socialId)
      return
    }

    sendUpdateUserStatus(user.userId, status)
  })

  client.onMessage((conversation, message) => {
    logger.info(`onMessage`, conversation, message)

    if (receivedMessages.hasOwnProperty(message.id)) {
      // message already processed, skipping
      return
    } else {
      receivedMessages[message.id] = Date.now()
    }

    const { socialInfo } = store.getState().friends
    const friend = Object.values(socialInfo).find((friend) => friend.conversationId === conversation.id)

    if (!friend) {
      logger.warn(`friend not found for conversation`, conversation.id)
      return
    }

    const profile = getProfile(store.getState(), identity.address)
    const blocked = profile?.blocked ?? []
    if (blocked.includes(friend.userId)) {
      logger.warn(`got a message from blocked user`, friend.userId)
      return
    }

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

  const conversations: {
    conversation: Conversation
    unreadMessages: boolean
  }[] = yield client.getAllCurrentConversations()

  yield Promise.all(
    conversations.map(async ({ conversation }) => {
      const cursor = await client.getCursorOnLastMessage(conversation.id, { initialSize: INITIAL_CHAT_SIZE })
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
    })
  )
}

function* initializePrivateMessaging() {
  const synapseUrl: string = yield select(getSynapseUrl)
  const identity: ExplorerIdentity | undefined = yield select(getCurrentIdentity)

  if (!identity) return

  const { address: ethAddress } = identity
  const timestamp: number = Date.now()

  // TODO: the "timestamp" should be a message also signed by a catalyst.
  const messageToSign = `${timestamp}`

  const authChain = Authenticator.signPayload(identity, messageToSign)

  const client: SocialAPI = yield apply(SocialClient, SocialClient.loginToServer, [
    synapseUrl,
    ethAddress,
    timestamp,
    authChain
  ])

  yield put(setMatrixClient(client))
}

function* refreshFriends() {
  const client: SocialAPI | null = yield select(getSocialClient)

  if (!client) return

  const ownId = client.getUserId()
  logger.info(`initializePrivateMessaging#ownId`, ownId)

  // init friends
  const friends: string[] = yield client.getAllFriends()
  logger.info(`friends`, friends)

  const friendsSocial: SocialData[] = yield Promise.all(
    toSocialData(friends).map(async (friend) => {
      const conversation = await client.createDirectConversation(friend.socialId)
      return { ...friend, conversationId: conversation.id }
    })
  )

  // init friend requests
  const friendRequests: FriendshipRequest[] = yield client.getPendingRequests()
  logger.info(`friendRequests`, friendRequests)

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

  const friendIds = friendsSocial.map(($) => $.userId)
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

  const profileIds = Object.values(socialInfo).map((socialData) => socialData.userId)

  yield Promise.all(profileIds.map((userId) => ensureFriendProfile(userId)))

  const initMessage = {
    currentFriends: friendIds,
    requestedTo: requestedToIds,
    requestedFrom: requestedFromIds
  }

  getUnityInstance().InitializeFriends(initMessage)

  return { friendsSocial, ownId }
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

function sendUpdateUserStatus(id: string, status: CurrentUserStatus) {
  logger.info(`sendUpdateUserStatus`, id, status)
  // treat 'unavailable' status as 'online'
  const presence: PresenceStatus =
    status.presence === PresenceType.OFFLINE ? PresenceStatus.OFFLINE : PresenceStatus.ONLINE

  const userId = parseUserId(id)

  if (!userId) return

  if (presence === PresenceStatus.ONLINE) {
    if (!status.realm && !status.position) {
      const lastPresence = presenceMap[userId]

      logger.info(`online status with no realm & position, using from map`, userId, lastPresence)
      status.realm = lastPresence?.realm
      status.position = lastPresence?.position
    } else {
      presenceMap[userId] = { realm: status.realm, position: status.position }
    }
  }

  const updateMessage = {
    userId,
    realm: status.realm,
    position: status.position,
    presence
  }

  logger.info(`getUnityInstance().UpdateUserPresence`, updateMessage)
  getUnityInstance().UpdateUserPresence(updateMessage)
  notifyFriendOnlineStatusThroughChat(updateMessage)
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

    const shouldSendNewStatus =
      !lastStatus || !deepEqual(position, lastStatus.position) || !deepEqual(realm, lastStatus.realm)

    if (shouldSendNewStatus) {
      const updateStatus: UpdateUserStatus = {
        realm: {
          layer: '',
          serverName: realm.serverName
        },
        position,
        presence: PresenceType.ONLINE
      }

      logger.info(`sending update status`, updateStatus)

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

  const conversation: Conversation = yield apply(client, client.createDirectConversation, [userData.socialId])
  yield apply(client, client.sendMessageTo, [conversation.id, message])
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
      yield apply(client, client.createDirectConversation, [socialData.socialId])
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
            const conversation: Conversation = yield client.createDirectConversation(socialData.socialId)

            logger.info(`userData`, userId, socialData.socialId, conversation.id)
            newState.socialInfo[userId] = { userId, socialId: socialData.socialId, conversationId: conversation.id }
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
      trackEvent('Friend request approved', {})
      break
    }
    case FriendshipAction.REJECTED: {
      trackEvent('Friend request rejected', {})
      break
    }
    case FriendshipAction.CANCELED: {
      trackEvent('Friend request cancelled', {})
      break
    }
    case FriendshipAction.REQUESTED_FROM: {
      trackEvent('Friend request received', {})
      break
    }
    case FriendshipAction.REQUESTED_TO: {
      trackEvent('Friend request sent', {})
      break
    }
    case FriendshipAction.DELETED: {
      trackEvent('Friend deleted', {})
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

const friendStatus: Record<string, PresenceStatus> = {}

function notifyFriendOnlineStatusThroughChat(userStatus: UpdateUserStatusMessage) {
  const friendName = getProfile(store.getState(), userStatus.userId)?.name

  if (friendName === undefined) {
    return
  }

  if (!friendStatus[friendName]) {
    friendStatus[friendName] = userStatus.presence
    return
  }

  if (!userStatus.realm?.serverName) {
    if (userStatus.presence !== PresenceStatus.ONLINE) {
      friendStatus[friendName] = userStatus.presence
    }
    return
  }

  if (userStatus.presence === PresenceStatus.ONLINE && friendStatus[friendName] === PresenceStatus.OFFLINE) {
    let message = `${friendName} joined ${userStatus.realm?.serverName}`

    if (userStatus.position) {
      message += ` ${userStatus.position.x}, ${userStatus.position.y}`
    }

    notifyStatusThroughChat(message)
  }

  friendStatus[friendName] = userStatus.presence
}
