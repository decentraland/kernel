import { COMMS_PROFILE_TIMEOUT } from 'config'
import type { CommunicationsController } from 'shared/apis/CommunicationsController'
import { ChatMessage as InternalChatMessage, ChatMessageType } from 'shared/types'
import {
  getPeer,
  avatarMessageObservable,
  setupPeer,
  ensureTrackingUniqueAndLatest,
  receiveUserPosition
} from './peers'
import {
  Package,
  ChatMessage,
  ProfileVersion,
  AvatarMessageType,
  ProfileRequest,
  ProfileResponse
} from './interface/types'
import { Position } from './interface/utils'
import { store } from 'shared/store/isolatedStore'
import { getCurrentUserProfile, getProfileFromStore } from 'shared/profiles/selectors'
import { messageReceived } from '../chat/actions'
import { getBannedUsers } from 'shared/meta/selectors'
import { getIdentity } from 'shared/session'
import { CommsContext, commsLogger } from './context'
import { isBlockedOrBanned, processVoiceFragment } from './voice-over-comms'
import future, { IFuture } from 'fp-future'
import { handleCommsDisconnection } from './actions'
import { Avatar } from '@dcl/schemas'
import { Observable } from 'mz-observable'
import { eventChannel } from 'redux-saga'
import { ProfileAsPromise } from 'shared/profiles/ProfileAsPromise'
import { trackEvent } from 'shared/analytics'

export const scenesSubscribedToCommsEvents = new Set<CommunicationsController>()
const receiveProfileOverCommsChannel = new Observable<Avatar>()
const sendMyProfileOverCommsChannel = new Observable<{}>()

export function subscribeParcelSceneToCommsMessages(controller: CommunicationsController) {
  scenesSubscribedToCommsEvents.add(controller)
}

export function unsubscribeParcelSceneToCommsMessages(controller: CommunicationsController) {
  scenesSubscribedToCommsEvents.delete(controller)
}

export async function bindHandlersToCommsContext(context: CommsContext) {
  commsLogger.log('Binding handlers: ', context)

  const connection = context.worldInstanceConnection!

  context.onDisconnectObservable.add(() => store.dispatch(handleCommsDisconnection(context)))

  connection.events.on('position', processPositionMessage)
  connection.events.on('profileMessage', processProfileUpdatedMessage)
  connection.events.on('chatMessage', processChatMessage)
  connection.events.on('sceneMessageBus', processParcelSceneCommsMessage)
  connection.events.on('profileRequest', processProfileRequest)
  connection.events.on('profileResponse', processProfileResponse)
  connection.events.on('voiceMessage', processVoiceFragment)
}

const pendingProfileRequests: Record<string, IFuture<Avatar | null>[]> = {}

export async function requestLocalProfileToPeers(
  context: CommsContext,
  userId: string,
  version?: number
): Promise<Avatar | null> {
  if (context && context.currentPosition) {
    if (!pendingProfileRequests[userId]) {
      pendingProfileRequests[userId] = []
    }

    const thisFuture = future<Avatar | null>()

    pendingProfileRequests[userId].push(thisFuture)

    await context.worldInstanceConnection.sendProfileRequest(context.currentPosition, userId, version)

    setTimeout(function () {
      if (thisFuture.isPending) {
        // We resolve with a null profile. This will fallback to a random profile
        thisFuture.resolve(null)
        const pendingRequests = pendingProfileRequests[userId]
        if (pendingRequests && pendingRequests.includes(thisFuture)) {
          pendingRequests.splice(pendingRequests.indexOf(thisFuture), 1)
        }
      }
    }, COMMS_PROFILE_TIMEOUT)

    return thisFuture
  } else {
    // We resolve with a null profile. This will fallback to a random profile
    return Promise.resolve(null)
  }
}

function processProfileUpdatedMessage(message: Package<ProfileVersion>) {
  const msgTimestamp = message.time

  const peerTrackingInfo = setupPeer(message.sender)
  if (!peerTrackingInfo.ethereumAddress) commsLogger.info('Peer ', message.sender, 'is now', message.data.user)
  peerTrackingInfo.ethereumAddress = message.data.user
  peerTrackingInfo.profileType = message.data.type

  peerTrackingInfo.lastUpdate = Date.now()

  if (msgTimestamp > peerTrackingInfo.lastProfileUpdate) {
    peerTrackingInfo.lastProfileUpdate = msgTimestamp

    // remove duplicates
    ensureTrackingUniqueAndLatest(peerTrackingInfo)

    const profileVersion = +message.data.version
    const currentProfile = getProfileFromStore(store.getState(), message.data.user)

    const shouldLoadRemoteProfile =
      !currentProfile ||
      currentProfile.status == 'error' ||
      (currentProfile.status == 'ok' && currentProfile.data.version < profileVersion)

    if (shouldLoadRemoteProfile) {
      ProfileAsPromise(message.data.user, profileVersion, peerTrackingInfo.profileType).catch((e: Error) => {
        trackEvent('error_fatal', {
          message: `error loading profile ${message.data.user}:${profileVersion}: ` + e.message,
          context: 'kernel#saga',
          stack: e.stack || 'processProfileUpdatedMessage'
        })
      })
    }
  }
}

// TODO: Change ChatData to the new class once it is added to the .proto
function processParcelSceneCommsMessage(message: Package<ChatMessage>) {
  const peer = getPeer(message.sender)

  if (peer) {
    const { id: cid, text } = message.data
    scenesSubscribedToCommsEvents.forEach(($) => {
      if ($.cid === cid) {
        $.receiveCommsMessage(text, peer)
      }
    })
  }
}

function processChatMessage(message: Package<ChatMessage>) {
  const msgId = message.data.id
  const myProfile = getCurrentUserProfile(store.getState())
  const fromAlias: string = message.sender
  const senderPeer = setupPeer(fromAlias)

  if (!senderPeer.receivedPublicChatMessages.has(msgId)) {
    const text = message.data.text
    senderPeer.receivedPublicChatMessages.add(msgId)
    senderPeer.lastUpdate = Date.now()

    if (senderPeer.ethereumAddress) {
      if (text.startsWith('␐')) {
        const [id, timestamp] = text.split(' ')
        avatarMessageObservable.notifyObservers({
          type: AvatarMessageType.USER_EXPRESSION,
          userId: senderPeer.ethereumAddress,
          expressionId: id.slice(1),
          timestamp: parseInt(timestamp, 10)
        })
      } else {
        const isBanned =
          !myProfile ||
          (senderPeer.ethereumAddress &&
            isBlockedOrBanned(myProfile, getBannedUsers(store.getState()), senderPeer.ethereumAddress)) ||
          false

        if (!isBanned) {
          const messageEntry: InternalChatMessage = {
            messageType: ChatMessageType.PUBLIC,
            messageId: msgId,
            sender: senderPeer.ethereumAddress,
            body: text,
            timestamp: Date.now()
          }
          store.dispatch(messageReceived(messageEntry))
        }
      }
    }
  }
}

// Receive a "rpc" signal over comms to send our profile
function processProfileRequest(message: Package<ProfileRequest>) {
  const myIdentity = getIdentity()
  const myAddress = myIdentity?.address

  // We only send profile responses for our own address
  if (message.data.userId === myAddress) {
    sendMyProfileOverCommsChannel.notifyObservers({})
  }
}

function processProfileResponse(message: Package<ProfileResponse>) {
  const peerTrackingInfo = setupPeer(message.sender)

  const profile = message.data.profile

  if (peerTrackingInfo.ethereumAddress !== profile.userId) return

  if (pendingProfileRequests[profile.userId] && pendingProfileRequests[profile.userId].length > 0) {
    pendingProfileRequests[profile.userId].forEach((it) => it.resolve(profile))
    delete pendingProfileRequests[profile.userId]
  }

  // TODO: send whether or no hasWeb3 connection on ProfileResponse
  // If we received an unexpected profile, maybe the profile saga can use this preemptively
  receiveProfileOverCommsChannel.notifyObservers(profile)
}

export function createSendMyProfileOverCommsChannel() {
  return eventChannel<{}>((emitter) => {
    const listener = sendMyProfileOverCommsChannel.add(emitter)
    return () => {
      sendMyProfileOverCommsChannel.remove(listener)
    }
  })
}

export function createReceiveProfileOverCommsChannel() {
  return eventChannel<Avatar>((emitter) => {
    const listener = receiveProfileOverCommsChannel.add(emitter)
    return () => {
      receiveProfileOverCommsChannel.remove(listener)
    }
  })
}

function processPositionMessage(message: Package<Position>) {
  receiveUserPosition(message.sender, message.data, message.time)
}
