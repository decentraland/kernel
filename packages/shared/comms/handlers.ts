import { COMMS_PROFILE_TIMEOUT } from 'config'
import { ChatMessage as InternalChatMessage, ChatMessageType } from 'shared/types'
import {
  getPeer,
  avatarMessageObservable,
  setupPeer,
  ensureTrackingUniqueAndLatest,
  receiveUserPosition,
  removeAllPeers,
  removePeerByAddress
} from './peers'
import { AvatarMessageType, Package } from './interface/types'
import * as proto from 'shared/protocol/kernel/comms/comms-rfc-4.gen'
import { store } from 'shared/store/isolatedStore'
import { getCurrentUserProfile, getProfileFromStore } from 'shared/profiles/selectors'
import { messageReceived } from '../chat/actions'
import { getBannedUsers } from 'shared/meta/selectors'
import { getIdentity } from 'shared/session'
import { CommsContext } from './context'
import { processVoiceFragment } from 'shared/voiceChat/handlers'
import future, { IFuture } from 'fp-future'
import { handleCommsDisconnection } from './actions'
import { Avatar } from '@dcl/schemas'
import { Observable } from 'mz-observable'
import { eventChannel } from 'redux-saga'
import { ProfileAsPromise } from 'shared/profiles/ProfileAsPromise'
import { trackEvent } from 'shared/analytics'
import { ProfileType } from 'shared/profiles/types'
import { ensureAvatarCompatibilityFormat } from 'shared/profiles/transformations/profileToServerFormat'
import { scenesSubscribedToCommsEvents } from './sceneSubscriptions'
import { isBlockedOrBanned } from 'shared/voiceChat/selectors'
import { uuid } from 'atomicHelpers/math'
import { validateAvatar } from 'shared/profiles/schemaValidation'
import { CommsDisconnectionEvent, CommsPeerDisconnectedEvent } from './interface'
import { sendPublicChatMessage } from '.'

type PingRequest = {
  alias: number
  responses: number
  sentTime: number
}

const receiveProfileOverCommsChannel = new Observable<Avatar>()
const sendMyProfileOverCommsChannel = new Observable<Record<string, never>>()
const pingRequests = new Map<number, PingRequest>()
let pingIndex = 0

export async function bindHandlersToCommsContext(context: CommsContext) {
  removeAllPeers()
  pingRequests.clear()

  const connection = context.worldInstanceConnection!

  context.onDisconnectObservable.add(() => store.dispatch(handleCommsDisconnection(context)))

  // RFC4 messages
  connection.events.on('position', processPositionMessage)
  connection.events.on('profileMessage', processProfileUpdatedMessage)
  connection.events.on('chatMessage', processChatMessage)
  connection.events.on('sceneMessageBus', processParcelSceneCommsMessage)
  connection.events.on('profileRequest', processProfileRequest)
  connection.events.on('profileResponse', processProfileResponse)
  connection.events.on('voiceMessage', processVoiceFragment)

  // transport messages
  connection.events.on('PEER_DISCONNECTED', handleDisconnectPeer)
  connection.events.on('DISCONNECTION', handleDisconnection)
}

const pendingProfileRequests: Map<string, Set<IFuture<Avatar | null>>> = new Map()

export async function requestProfileToPeers(
  context: CommsContext,
  address: string,
  profileVersion: number
): Promise<Avatar | null> {
  if (context) {
    if (!pendingProfileRequests.has(address)) {
      pendingProfileRequests.set(address, new Set())
    }

    const thisFuture = future<Avatar | null>()

    pendingProfileRequests.get(address)!.add(thisFuture)

    await context.worldInstanceConnection.sendProfileRequest({
      address,
      profileVersion
    })

    setTimeout(function () {
      if (thisFuture.isPending) {
        // We resolve with a null profile. This will fallback to a random profile
        thisFuture.resolve(null)
        const pendingRequests = pendingProfileRequests.get(address)
        if (pendingRequests && pendingRequests.has(thisFuture)) {
          pendingRequests.delete(thisFuture)
        }
      }
    }, COMMS_PROFILE_TIMEOUT)

    return thisFuture
  } else {
    // We resolve with a null profile. This will fallback to a random profile
    return Promise.resolve(null)
  }
}

function handleDisconnection(data: CommsDisconnectionEvent) {
  // when we are kicked, the explorer should re-load, or maybe go to offline~offline realm
  if (data.kicked) {
    const url = new URL(document.location.toString())
    url.search = ''
    url.searchParams.set('disconnection-reason', 'logged-in-somewhere-else')
    document.location = url.toString()
  }
}

function handleDisconnectPeer(data: CommsPeerDisconnectedEvent) {
  removePeerByAddress(data.address)
}

function processProfileUpdatedMessage(message: Package<proto.AnnounceProfileVersion>) {
  const msgTimestamp = message.time

  const peerTrackingInfo = setupPeer(message.address)
  peerTrackingInfo.ethereumAddress = message.address
  peerTrackingInfo.lastUpdate = Date.now()

  if (msgTimestamp > peerTrackingInfo.lastProfileUpdate) {
    peerTrackingInfo.lastProfileUpdate = msgTimestamp

    // remove duplicates
    ensureTrackingUniqueAndLatest(peerTrackingInfo)

    const profileVersion = +message.data.profileVersion
    const currentProfile = getProfileFromStore(store.getState(), message.address)

    const shouldLoadRemoteProfile =
      !currentProfile ||
      currentProfile.status === 'error' ||
      (currentProfile.status === 'ok' && currentProfile.data.version < profileVersion)

    if (shouldLoadRemoteProfile) {
      ProfileAsPromise(
        message.address,
        profileVersion,
        /* we ask for LOCAL to ask information about the profile using comms o not overload the servers*/
        ProfileType.LOCAL
      ).catch((e: Error) => {
        trackEvent('error', {
          message: `error loading profile ${message.address}:${profileVersion}: ` + e.message,
          context: 'kernel#saga',
          stack: e.stack || 'processProfileUpdatedMessage'
        })
      })
    }
  }
}

// TODO: Change ChatData to the new class once it is added to the .proto
function processParcelSceneCommsMessage(message: Package<proto.Scene>) {
  const peer = getPeer(message.address)

  if (peer) {
    const { sceneId, data } = message.data
    scenesSubscribedToCommsEvents.forEach(($) => {
      if ($.cid === sceneId) {
        $.receiveCommsMessage(data, peer)
      }
    })
  }
}

globalThis.__sendPing = () => {
  const nonce = Math.floor(Math.random() * 0xffffffff)
  pingRequests.set(nonce, {
    responses: 0,
    sentTime: Date.now(),
    alias: pingIndex++
  })
  sendPublicChatMessage(`␐ping ${nonce}`)
}

function processChatMessage(message: Package<proto.Chat>) {
  const myProfile = getCurrentUserProfile(store.getState())
  const fromAlias: string = message.address
  const senderPeer = setupPeer(fromAlias)

  senderPeer.lastUpdate = Date.now()

  if (senderPeer.ethereumAddress) {
    if (message.data.message.startsWith('␐')) {
      const [id, secondPart] = message.data.message.split(' ')

      const expressionId = id.slice(1)
      if (expressionId === 'ping') {
        const nonce = parseInt(secondPart, 10)
        const request = pingRequests.get(nonce)
        if (request) {
          request.responses++
          console.log(`ping ${request.alias} has ${request.responses} responses (nonce: ${nonce})`)
        } else {
          sendPublicChatMessage(message.data.message)
        }
      }

      avatarMessageObservable.notifyObservers({
        type: AvatarMessageType.USER_EXPRESSION,
        userId: senderPeer.ethereumAddress,
        expressionId,
        timestamp: parseInt(secondPart, 10)
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
          messageId: uuid(),
          sender: senderPeer.ethereumAddress,
          body: message.data.message,
          timestamp: message.time
        }
        store.dispatch(messageReceived(messageEntry))
      }
    }
  }
}

// Receive a "rpc" signal over comms to send our profile
function processProfileRequest(message: Package<proto.ProfileRequest>) {
  const myIdentity = getIdentity()
  const myAddress = myIdentity?.address

  // We only send profile responses for our own address
  if (message.data.address.toLowerCase() === myAddress?.toLowerCase()) {
    sendMyProfileOverCommsChannel.notifyObservers({})
  }
}

function processProfileResponse(message: Package<proto.ProfileResponse>) {
  const peerTrackingInfo = setupPeer(message.address)

  const profile = ensureAvatarCompatibilityFormat(JSON.parse(message.data.serializedProfile))

  if (!validateAvatar(profile)) {
    console.error('Invalid avatar received', validateAvatar.errors)
    debugger
  }

  if (peerTrackingInfo.ethereumAddress !== profile.userId) return

  const promises = pendingProfileRequests.get(profile.userId)

  if (promises?.size) {
    promises.forEach((it) => it.resolve(profile))
    pendingProfileRequests.delete(profile.userId)
  }

  // If we received an unexpected profile, maybe the profile saga can use this preemptively
  receiveProfileOverCommsChannel.notifyObservers(profile)
}

export function createSendMyProfileOverCommsChannel() {
  return eventChannel<Record<string, never>>((emitter) => {
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

function processPositionMessage(message: Package<proto.Position>) {
  receiveUserPosition(message.address, message.data, message.time)
}
