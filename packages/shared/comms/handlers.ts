import { genericAvatarSnapshots, COMMS_PROFILE_TIMEOUT } from 'config'
import type { CommunicationsController } from 'shared/apis/CommunicationsController'
import { ChatMessage as InternalChatMessage, ChatMessageType } from 'shared/types'
import { ProfileAsPromise } from '../profiles/ProfileAsPromise'
import { getPeer, getUser, avatarMessageObservable } from './peers'
import {
  Package,
  ChatMessage,
  ProfileVersion,
  BusMessage,
  AvatarMessageType,
  ProfileRequest,
  ProfileResponse,
  VoiceFragment
} from './interface/types'
import { Position } from './interface/utils'
import { store } from 'shared/store/isolatedStore'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { messageReceived } from '../chat/actions'
import { getBannedUsers } from 'shared/meta/selectors'
import { getIdentity } from 'shared/session'
import { getProfileType } from 'shared/profiles/getProfileType'
import { sleep } from 'atomicHelpers/sleep'
import { localProfileReceived } from 'shared/profiles/actions'
import { isURL } from 'atomicHelpers/isURL'
import { CommsContext, commsLogger } from './context'
import { isBlockedOrBanned, processVoiceFragment } from './voice-over-comms'
import future, { IFuture } from 'fp-future'
import { handleCommsDisconnection } from './actions'
import { Avatar, Snapshots } from '@dcl/schemas'

export const scenesSubscribedToCommsEvents = new Set<CommunicationsController>()

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

  connection.events.on('position', (data: Package<Position>) => {
    processPositionMessage(context, data)
  })
  connection.events.on('profileMessage', (data: Package<ProfileVersion>) => {
    processProfileMessage(context, data)
  })
  connection.events.on('chatMessage', (data: Package<ChatMessage>) => {
    processChatMessage(context, data)
  })
  connection.events.on('sceneMessageBus', (data: Package<BusMessage>) => {
    processParcelSceneCommsMessage(data)
  })
  connection.events.on('profileRequest', (data: Package<ProfileRequest>) => {
    processProfileRequest(context, data)
  })
  connection.events.on('profileResponse', (data: Package<ProfileResponse>) => {
    processProfileResponse(context, data)
  })
  connection.events.on('voiceMessage', (data: Package<VoiceFragment>) => {
    processVoiceFragment(context, data)
  })
}

const pendingProfileRequests: Record<string, IFuture<Avatar | null>[]> = {}
export async function requestLocalProfileToPeers(
  context: CommsContext,
  userId: string,
  version?: number
): Promise<Avatar | null> {
  if (context && context.worldInstanceConnection && context.currentPosition) {
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

function processProfileMessage(context: CommsContext, message: Package<ProfileVersion>) {
  const msgTimestamp = message.time

  const peerTrackingInfo = context.ensurePeerTrackingInfo(message.sender)

  if (msgTimestamp > peerTrackingInfo.lastProfileUpdate) {
    peerTrackingInfo.lastProfileUpdate = msgTimestamp
    peerTrackingInfo.identity = message.data.user
    peerTrackingInfo.lastUpdate = Date.now()
    peerTrackingInfo.profileType = message.data.type

    if (context.ensureTrackingUniqueAndLatest(message.sender, message.data.user, msgTimestamp)) {
      const profileVersion = message.data.version
      peerTrackingInfo.loadProfileIfNecessary(profileVersion ? parseInt(profileVersion, 10) : 0)
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

function processChatMessage(context: CommsContext, message: Package<ChatMessage>) {
  const msgId = message.data.id
  const profile = getCurrentUserProfile(store.getState())
  const fromAlias: string = message.sender
  const peerTrackingInfo = context.ensurePeerTrackingInfo(fromAlias)
  if (!peerTrackingInfo.receivedPublicChatMessages.has(msgId)) {
    const text = message.data.text
    peerTrackingInfo.receivedPublicChatMessages.add(msgId)

    const user = getUser(fromAlias)
    if (user) {
      if (text.startsWith('␐')) {
        const [id, timestamp] = text.split(' ')
        avatarMessageObservable.notifyObservers({
          type: AvatarMessageType.USER_EXPRESSION,
          uuid: fromAlias,
          expressionId: id.slice(1),
          timestamp: parseInt(timestamp, 10)
        })
      } else {
        if (profile && user.userId && !isBlockedOrBanned(profile, getBannedUsers(store.getState()), user.userId)) {
          const messageEntry: InternalChatMessage = {
            messageType: ChatMessageType.PUBLIC,
            messageId: msgId,
            sender: user.userId || 'unknown',
            body: text,
            timestamp: Date.now()
          }
          store.dispatch(messageReceived(messageEntry))
        }
      }
    }
  }
}

const TIME_BETWEEN_PROFILE_RESPONSES = 1000

function processProfileRequest(context: CommsContext, message: Package<ProfileRequest>) {
  const myIdentity = getIdentity()
  const myAddress = myIdentity?.address

  // We only send profile responses for our own address
  if (message.data.userId !== myAddress) return

  // If we are already sending a profile response, we don't want to schedule another
  if (context.sendingProfileResponse) return

  context.sendingProfileResponse = true
  ;(async () => {
    const timeSinceLastProfile = Date.now() - context.lastProfileResponseTime

    // We don't want to send profile responses too frequently, so we delay the response to send a maximum of 1 per TIME_BETWEEN_PROFILE_RESPONSES
    if (timeSinceLastProfile < TIME_BETWEEN_PROFILE_RESPONSES) {
      await sleep(TIME_BETWEEN_PROFILE_RESPONSES - timeSinceLastProfile)
    }

    const profile = await ProfileAsPromise(
      myAddress,
      message.data.version ? parseInt(message.data.version, 10) : undefined,
      getProfileType(myIdentity)
    )

    if (context.currentPosition && context.worldInstanceConnection) {
      await context.worldInstanceConnection.sendProfileResponse(context.currentPosition, stripSnapshots(profile))
    }

    context.lastProfileResponseTime = Date.now()
  })()
    .finally(() => (context.sendingProfileResponse = false))
    .catch((e) => console.error('Error getting profile for responding request to comms', e))
}

function processProfileResponse(context: CommsContext, message: Package<ProfileResponse>) {
  const peerTrackingInfo = context.ensurePeerTrackingInfo(message.sender)

  const profile = message.data.profile

  if (peerTrackingInfo.identity !== profile.userId) return

  if (pendingProfileRequests[profile.userId] && pendingProfileRequests[profile.userId].length > 0) {
    pendingProfileRequests[profile.userId].forEach((it) => it.resolve(profile))
    delete pendingProfileRequests[profile.userId]
  } else {
    // If we received an unexpected profile, maybe the profile saga can use this preemptively
    store.dispatch(localProfileReceived(profile.userId, profile))
  }
}

function processPositionMessage(context: CommsContext, message: Package<Position>) {
  const msgTimestamp = message.time

  const peerTrackingInfo = context.ensurePeerTrackingInfo(message.sender)

  const immediateReposition = message.data[7]
  if (immediateReposition || msgTimestamp > peerTrackingInfo.lastPositionUpdate) {
    const p = message.data

    peerTrackingInfo.position = p
    peerTrackingInfo.lastPositionUpdate = msgTimestamp
    peerTrackingInfo.lastUpdate = Date.now()
  }
}

function stripSnapshots(profile: Avatar): Avatar {
  const newSnapshots: Record<string, string> = {}
  const currentSnapshots: Record<string, string> = profile.avatar.snapshots

  for (const snapshotKey of ['face256', 'body'] as const) {
    const snapshot = currentSnapshots[snapshotKey]
    newSnapshots[snapshotKey] =
      snapshot && (snapshot.startsWith('/') || snapshot.startsWith('./') || isURL(snapshot))
        ? snapshot
        : genericAvatarSnapshots[snapshotKey]
  }
  return {
    ...profile,
    avatar: { ...profile.avatar, snapshots: newSnapshots as Snapshots }
  }
}
