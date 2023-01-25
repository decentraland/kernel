import { Observable } from 'mz-observable'
import { PeerInformation, AvatarMessage, AvatarMessageType } from './interface/types'
import { profileToRendererFormat } from 'shared/profiles/transformations/profileToRendererFormat'
import {
  CommunicationArea,
  position2parcelRfc4,
  positionReportToCommsPositionRfc4,
  squareDistanceRfc4
} from './interface/utils'
import { commConfigurations } from 'config'
import { MORDOR_POSITION_RFC4 } from './const'
import { store } from 'shared/store/isolatedStore'
import { lastPlayerPositionReport } from 'shared/world/positionThings'
import { Avatar, EthAddress } from '@dcl/schemas'
import { getProfileFromStore } from 'shared/profiles/selectors'
import * as rfc4 from '@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen'

const peerMap = new Map<string, PeerInformation>()
export const avatarMessageObservable = new Observable<AvatarMessage>()

export function getAllPeers() {
  return new Map(peerMap)
}

;(globalThis as any).peerMap = peerMap

/**
 * Removes both the peer information and the Avatar from the world.
 * @param address
 */
export function removePeerByAddress(address: string): boolean {
  const peer = peerMap.get(address.toLowerCase())
  if (peer) {
    peerMap.delete(address.toLowerCase())
    avatarMessageObservable.notifyObservers({
      type: AvatarMessageType.USER_REMOVED,
      userId: peer.ethereumAddress
    })
    return true
  }
  return false
}

/**
 * This function is used to get the current user's information. The result is read-only.
 */
export function getPeer(address: string): Readonly<PeerInformation> | null {
  if (!address) return null
  return peerMap.get(address.toLowerCase()) || null
}

/**
 * If not exist, sets up a new avatar and profile object
 * @param address
 */
export function setupPeer(address: string): PeerInformation {
  if (!address) throw new Error('Did not receive a valid Address')
  if (typeof (address as any) !== 'string') throw new Error('Did not receive a valid Address')
  if (!EthAddress.validate(address)) throw new Error('Did not receive a valid Address')

  const ethereumAddress = address.toLowerCase()

  if (!peerMap.has(ethereumAddress)) {
    const peer: PeerInformation = {
      ethereumAddress,
      lastPositionIndex: 0,
      lastProfileVersion: -1,
      lastUpdate: Date.now(),
      talking: false,
      visible: true
    }

    peerMap.set(ethereumAddress, peer)

    // if we have user data, then send it to the avatar-scene
    sendPeerUserData(address)

    return peer
  } else {
    return peerMap.get(ethereumAddress)!
  }
}

export function receivePeerUserData(avatar: Avatar, baseUrl: string) {
  const ethereumAddress = avatar.userId.toLowerCase()
  const peer = peerMap.get(ethereumAddress)
  if (peer) {
    peer.baseUrl = baseUrl
    sendPeerUserData(ethereumAddress)
  }
}

function sendPeerUserData(address: string) {
  const peer = getPeer(address)
  if (peer && peer.baseUrl) {
    const profile = avatarUiProfileForUserId(peer.ethereumAddress, peer.baseUrl)
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

export function receiveUserTalking(address: string, talking: boolean) {
  const peer = setupPeer(address)
  peer.talking = talking
  peer.lastUpdate = Date.now()
  avatarMessageObservable.notifyObservers({
    type: AvatarMessageType.USER_TALKING,
    userId: peer.ethereumAddress,
    talking
  })
}

export function receiveUserPosition(address: string, position: rfc4.Position) {
  if (
    position.positionX === MORDOR_POSITION_RFC4.positionX &&
    position.positionY === MORDOR_POSITION_RFC4.positionY &&
    position.positionZ === MORDOR_POSITION_RFC4.positionZ
  ) {
    removePeerByAddress(address)
    return
  }

  const peer = setupPeer(address)
  peer.lastUpdate = Date.now()

  if (position.index > peer.lastPositionIndex) {
    peer.position = position
    peer.lastPositionIndex = position.index

    sendPeerUserData(address)
  }
}

function avatarUiProfileForUserId(address: string, contentServerBaseUrl: string) {
  const avatar = getProfileFromStore(store.getState(), address)
  if (avatar && avatar.data) {
    return profileToRendererFormat(avatar.data, {
      address: address,
      baseUrl: contentServerBaseUrl
    })
  }
  return null
}

/**
 * In some cases, like minimizing the window, the user will be invisible to the rest of the world.
 * This function handles those visible changes.
 */
export function receiveUserVisible(address: string, visible: boolean) {
  const peer = setupPeer(address)
  const didChange = peer.visible !== visible
  peer.visible = visible
  if (didChange) {
    avatarMessageObservable.notifyObservers({
      type: AvatarMessageType.USER_VISIBLE,
      userId: peer.ethereumAddress,
      visible
    })
    if (visible) {
      // often changes in visibility may delete the avatar remotely.
      // we send all the USER_DATA to make sure the scene always have
      // the required information to render the whole avatar
      sendPeerUserData(address)
    }
  }
}

export function removeAllPeers() {
  for (const alias of peerMap.keys()) {
    removePeerByAddress(alias)
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
  let changed = false

  peerMap.forEach((info, address) => {
    if (info.ethereumAddress === currentPeer.ethereumAddress && address !== peer.ethereumAddress) {
      if (info.lastProfileVersion < currentPeer.lastProfileVersion) {
        removePeerByAddress(address)
        changed = true
      } else if (info.lastProfileVersion > currentPeer.lastProfileVersion) {
        removePeerByAddress(currentPeer.ethereumAddress)

        info.position = info.position || currentPeer.position
        info.visible = info.visible || currentPeer.visible

        currentPeer = info
      }
    }
  })

  return [currentPeer, changed]
}

export function processAvatarVisibility(maxVisiblePeers: number, myAddress: string | undefined) {
  if (!lastPlayerPositionReport) return
  const pos = positionReportToCommsPositionRfc4(lastPlayerPositionReport)
  const now = Date.now()

  type ProcessingPeerInfo = {
    alias: string
    squareDistance: number
    visible: boolean
  }

  const visiblePeers: ProcessingPeerInfo[] = []
  const commArea = new CommunicationArea(position2parcelRfc4(pos), commConfigurations.commRadius)

  for (const [peerAlias, trackingInfo] of getAllPeers()) {
    const msSinceLastUpdate = now - trackingInfo.lastUpdate

    if (msSinceLastUpdate > commConfigurations.peerTtlMs) {
      removePeerByAddress(peerAlias)
      continue
    }

    if (myAddress && trackingInfo.ethereumAddress === myAddress) {
      // If we are tracking a peer that is ourselves, we remove it
      removePeerByAddress(peerAlias)
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
      squareDistance: squareDistanceRfc4(pos, trackingInfo.position),
      alias: peerAlias,
      visible: trackingInfo.visible || false
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
}
