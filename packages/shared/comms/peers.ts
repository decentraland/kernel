import { Observable } from 'mz-observable'
import { UUID, PeerInformation, AvatarMessage, AvatarMessageType, Pose } from './interface/types'
import { profileToRendererFormat } from 'shared/profiles/transformations/profileToRendererFormat'
import { MinPeerData } from '@dcl/catalyst-peer'
import { CommunicationArea, position2parcel, positionReportToCommsPosition, squareDistance } from './interface/utils'
import { commConfigurations } from 'config'
import { MORDOR_POSITION, ProcessingPeerInfo } from './const'
import { store } from 'shared/store/isolatedStore'
import { lastPlayerPositionReport } from 'shared/world/positionThings'
import { Avatar } from '@dcl/schemas'
import { getProfileFromStore } from 'shared/profiles/selectors'
import { deepEqual } from 'atomicHelpers/deepEqual'
import { CommsContext } from './context'
import { getFetchContentUrlPrefix } from 'shared/dao/selectors'

const peerMap = new Map<UUID, PeerInformation>()
export const avatarMessageObservable = new Observable<AvatarMessage>()

export function getAllPeers() {
  return new Map(peerMap)
}

;(globalThis as any).peerMap = peerMap

/**
 * Removes both the peer information and the Avatar from the world.
 * @param uuid
 */
export function removePeerByUUID(uuid: UUID): boolean {
  const peer = peerMap.get(uuid)
  if (peer) {
    peerMap.delete(uuid)
    if (peer.ethereumAddress) {
      avatarMessageObservable.notifyObservers({
        type: AvatarMessageType.USER_REMOVED,
        userId: peer.ethereumAddress
      })
    }
    return true
  }
  return false
}

/**
 * This function is used to get the current user's information. The result is read-only.
 */
export function getPeer(uuid: UUID): Readonly<PeerInformation> | null {
  if (!uuid) return null
  return peerMap.get(uuid) || null
}

/**
 * If not exist, sets up a new avatar and profile object
 * @param uuid
 */
export function setupPeer(uuid: UUID): PeerInformation {
  if (!uuid) throw new Error('Did not receive a valid UUID')
  if (typeof (uuid as any) !== 'string') throw new Error('Did not receive a valid UUID')

  if (!peerMap.has(uuid)) {
    const peer: PeerInformation = {
      uuid,
      lastPositionUpdate: 0,
      lastProfileUpdate: 0,
      lastUpdate: Date.now(),
      receivedPublicChatMessages: new Set(),
      talking: false,
      visible: true
    }

    peerMap.set(uuid, peer)

    // if we have user data, then send it to the avatar-scene
    sendPeerUserData(uuid)

    return peer
  } else {
    return peerMap.get(uuid)!
  }
}

export function receivePeerUserData(avatar: Avatar) {
  for (const [uuid, peer] of peerMap) {
    if (peer.ethereumAddress === avatar.userId) {
      sendPeerUserData(uuid)
    }
  }
}

function sendPeerUserData(uuid: string) {
  const peer = getPeer(uuid)
  if (peer && peer.ethereumAddress) {
    const profile = avatarUiProfileForUserId(
      peer.ethereumAddress,
      // TODO: when profiles are federated, we must change this to accept the profile's
      //       home server
      getFetchContentUrlPrefix(store.getState())
    )
    if (profile) {
      avatarMessageObservable.notifyObservers({
        type: AvatarMessageType.USER_DATA,
        userId: peer.ethereumAddress,
        data: peer,
        profile
      })
    }
  }
}

export function receiveUserTalking(uuid: string, talking: boolean) {
  const peer = setupPeer(uuid)
  peer.talking = talking
  peer.lastUpdate = Date.now()
  if (peer.ethereumAddress) {
    avatarMessageObservable.notifyObservers({
      type: AvatarMessageType.USER_TALKING,
      userId: peer.ethereumAddress,
      talking
    })
  }
}

export function receiveUserPosition(uuid: string, position: Pose, msgTimestamp: number) {
  if (deepEqual(position, MORDOR_POSITION)) {
    removePeerByUUID(uuid)
    return
  }

  const peer = setupPeer(uuid)
  peer.lastUpdate = Date.now()

  if (msgTimestamp > peer.lastPositionUpdate) {
    peer.position = position
    peer.lastPositionUpdate = msgTimestamp

    sendPeerUserData(uuid)
  }
}

function avatarUiProfileForUserId(userId: string, contentServerBaseUrl: string) {
  const avatar = getProfileFromStore(store.getState(), userId)
  if (avatar && avatar.data) {
    return profileToRendererFormat(avatar.data, {
      address: userId,
      baseUrl: contentServerBaseUrl
    })
  }
  return null
}

/**
 * In some cases, like minimizing the window, the user will be invisible to the rest of the world.
 * This function handles those visible changes.
 */
export function receiveUserVisible(uuid: string, visible: boolean) {
  const peer = setupPeer(uuid)
  const didChange = peer.visible !== visible
  peer.visible = visible
  if (peer.ethereumAddress) {
    avatarMessageObservable.notifyObservers({
      type: AvatarMessageType.USER_VISIBLE,
      userId: peer.ethereumAddress,
      visible
    })
    if (didChange) {
      // often changes in visibility may delete the avatar remotely.
      // we send all the USER_DATA to make sure the scene always have
      // the required information to render the whole avatar
      sendPeerUserData(uuid)
    }
  }
}

export function removeMissingPeers(newPeers: MinPeerData[]) {
  for (const [key, { ethereumAddress }] of peerMap) {
    if (!newPeers.some((x) => x.id === key || x.id.toLowerCase() === ethereumAddress?.toLowerCase())) {
      removePeerByUUID(key)
    }
  }
}

export function removeAllPeers() {
  for (const alias of peerMap.keys()) {
    removePeerByUUID(alias)
  }
}

/**
 * Ensures that there is only one peer tracking info for this identity.
 * Returns true if this is the latest update and the one that remains.
 *
 * TODO(Mendez 24/04/2022): wtf does this function do?
 */
export function ensureTrackingUniqueAndLatest(peer: PeerInformation) {
  let currentPeer = peer

  peerMap.forEach((info, uuid) => {
    if (info.ethereumAddress === currentPeer.ethereumAddress && uuid !== peer.uuid) {
      if (info.lastProfileUpdate < currentPeer.lastProfileUpdate) {
        removePeerByUUID(uuid)
      } else if (info.lastProfileUpdate > currentPeer.lastProfileUpdate) {
        removePeerByUUID(currentPeer.uuid)

        info.position = info.position || currentPeer.position
        info.visible = info.visible || currentPeer.visible
        info.profile = info.profile || currentPeer.profile

        currentPeer = info
      }
    }
  })

  return currentPeer
}

export function processAvatarVisibility(
  maxVisiblePeers: number,
  context: CommsContext | null,
  myAddress: string | undefined
) {
  if (!lastPlayerPositionReport) return
  const pos = positionReportToCommsPosition(lastPlayerPositionReport)
  const now = Date.now()
  const visiblePeers: ProcessingPeerInfo[] = []
  const commArea = new CommunicationArea(position2parcel(pos), commConfigurations.commRadius)

  for (const [peerAlias, trackingInfo] of getAllPeers()) {
    const msSinceLastUpdate = now - trackingInfo.lastUpdate

    if (msSinceLastUpdate > commConfigurations.peerTtlMs) {
      removePeerByUUID(peerAlias)

      continue
    }

    if (myAddress && trackingInfo.ethereumAddress === myAddress) {
      // If we are tracking a peer that is ourselves, we remove it
      removePeerByUUID(peerAlias)
      continue
    }

    if (!trackingInfo.position) {
      continue
    }

    if (!commArea.contains(trackingInfo.position)) {
      receiveUserVisible(peerAlias, false)
      continue
    }

    visiblePeers.push({
      squareDistance: squareDistance(pos, trackingInfo.position),
      alias: peerAlias
    })
  }

  if (visiblePeers.length <= maxVisiblePeers) {
    for (const peerInfo of visiblePeers) {
      receiveUserVisible(peerInfo.alias, true)
    }
  } else {
    const sortedBySqDistanceVisiblePeers = visiblePeers.sort((p1, p2) => p1.squareDistance - p2.squareDistance)
    for (let i = 0; i < sortedBySqDistanceVisiblePeers.length; ++i) {
      const peer = sortedBySqDistanceVisiblePeers[i]

      if (i < maxVisiblePeers) {
        receiveUserVisible(peer.alias, true)
      } else {
        receiveUserVisible(peer.alias, false)
      }
    }
  }

  if (context && context.stats) {
    context.stats.visiblePeerIds = visiblePeers.map((it) => it.alias)
  }
}
