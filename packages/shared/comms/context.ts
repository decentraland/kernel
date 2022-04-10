import { commConfigurations, parcelLimits } from 'config'
import { lastPlayerPositionReport, positionObservable, PositionReport } from 'shared/world/positionThings'
import { Stats } from './debug'
import { receiveUserData, receiveUserPose, receiveUserVisible, removeById, receiveUserTalking } from './peers'
import { Pose, UserInformation } from './interface/types'
import {
  CommunicationArea,
  Position,
  position2parcel,
  positionReportToCommsPosition,
  sameParcel,
  squareDistance
} from './interface/utils'
import { isRendererEnabled, renderStateObservable } from '../world/worldState'
import { RoomConnection } from './interface/index'
import { store } from 'shared/store/isolatedStore'
import { getCommsConfig } from 'shared/meta/selectors'
import { getIdentity } from 'shared/session'
import { createLogger } from '../logger'
import { MinPeerData } from '@dcl/catalyst-peer'
import { Observable, Observer } from 'mz-observable'
import { setListenerSpatialParams } from './voice-over-comms'
import { scenesSubscribedToCommsEvents } from './handlers'
import { arrayEquals } from 'atomicHelpers/arrayEquals'
import { Realm } from 'shared/dao/types'
import { ProfileAsPromise } from 'shared/profiles/ProfileAsPromise'
import { profileToRendererFormat } from 'shared/profiles/transformations/profileToRendererFormat'
import { ProfileType } from 'shared/profiles/types'
import { ProfileForRenderer } from '@dcl/legacy-ecs'

export type CommsVersion = 'v1' | 'v2' | 'v3'
export type CommsMode = CommsV1Mode | CommsV2Mode
export type CommsV1Mode = 'local' | 'remote'
export type CommsV2Mode = 'p2p' | 'server'

export const MORDOR_POSITION: Position = [
  1000 * parcelLimits.parcelSize,
  1000,
  1000 * parcelLimits.parcelSize,
  0,
  0,
  0,
  0,
  true
]

export type PeerAlias = string
export type ProcessingPeerInfo = {
  alias: PeerAlias
  userInfo: UserInformation
  squareDistance: number
  position: Position
  talking: boolean
}

export const commsLogger = createLogger('comms: ')

export type ProfilePromiseState = {
  promise: Promise<ProfileForRenderer | void>
  version: number | null
  status: 'ok' | 'loading' | 'error'
}

export class PeerTrackingInfo {
  public position: Position | null = null
  public identity: string | null = null
  public userInfo: UserInformation | null = null
  public lastPositionUpdate: number = 0
  public lastProfileUpdate: number = 0
  public lastUpdate: number = 0
  public receivedPublicChatMessages = new Set<string>()
  public talking = false

  profilePromise: ProfilePromiseState = {
    promise: Promise.resolve(),
    version: null,
    status: 'loading'
  }

  profileType?: ProfileType

  public loadProfileIfNecessary(profileVersion: number) {
    if (this.identity && (profileVersion !== this.profilePromise.version || this.profilePromise.status === 'error')) {
      if (!this.userInfo) {
        this.userInfo = { userId: this.identity }
      }
      this.profilePromise = {
        promise: ProfileAsPromise(this.identity, profileVersion, this.profileType)
          .then((profile) => {
            const forRenderer = profileToRendererFormat(profile)
            this.lastProfileUpdate = new Date().getTime()
            const userInfo = this.userInfo || ({ userId: this.identity } as UserInformation)
            userInfo.version = profile.version
            this.userInfo = userInfo
            this.profilePromise.status = 'ok'
            return forRenderer
          })
          .catch((error) => {
            this.profilePromise.status = 'error'
            commsLogger.error('Error fetching profile!', error)
          }),
        version: profileVersion,
        status: 'loading'
      }
    }
  }
}

export class CommsContext {
  public readonly stats: Stats = new Stats()
  public commRadius: number

  public peerData = new Map<PeerAlias, PeerTrackingInfo>()
  public userInfo: UserInformation

  public currentPosition: Position | null = null

  public onDisconnectObservable = new Observable<void>()
  public worldInstanceConnection: RoomConnection | null = null

  timeToChangeRealm: number = Date.now() + commConfigurations.autoChangeRealmInterval
  lastProfileResponseTime: number = 0
  sendingProfileResponse: boolean = false
  positionUpdatesPaused: boolean = false

  private profileInterval?: ReturnType<typeof setInterval>
  private analyticsInterval?: ReturnType<typeof setInterval>
  private positionObserver: Observer<any> | null = null
  private worldRunningObserver?: Observer<any> | null = null
  private infoCollecterInterval?: ReturnType<typeof setInterval>

  private currentParcelTopics = ''
  private previousTopics = ''

  private lastNetworkUpdatePosition = new Date().getTime()
  private lastPositionSent: Position | undefined
  private destroyed = false

  constructor(public readonly realm: Realm, userInfo: UserInformation) {
    this.userInfo = userInfo

    this.commRadius = commConfigurations.commRadius
  }

  async connect(connection: RoomConnection) {
    try {
      this.worldInstanceConnection = connection

      this.worldInstanceConnection.events.on('DISCONNECTION', () => this.disconnect())
      await this.worldInstanceConnection.connect()

      this.onConnected()
    } catch (e: any) {
      await this.disconnect()
      throw e
    }
  }

  async disconnect() {
    if (this.destroyed) return
    commsLogger.info('Disconnecting comms context')
    this.destroyed = true
    this.onDisconnectObservable.notifyObservers()
    this.positionUpdatesPaused = true
    if (this.worldInstanceConnection) {
      await this.sendToMordor()
      await this.worldInstanceConnection.disconnect()
    }
    this.removeAllPeers()
    if (this.profileInterval) {
      clearInterval(this.profileInterval)
    }
    if (this.infoCollecterInterval) {
      clearInterval(this.infoCollecterInterval)
    }
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval)
    }
    if (this.positionObserver) {
      positionObservable.remove(this.positionObserver)
    }
    if (this.worldRunningObserver) {
      renderStateObservable.remove(this.worldRunningObserver)
    }
  }

  /**
   * Ensures that there is only one peer tracking info for this identity.
   * Returns true if this is the latest update and the one that remains
   */
  ensureTrackingUniqueAndLatest(fromAlias: string, peerIdentity: string, thisUpdateTimestamp: number) {
    let currentLastProfileAlias = fromAlias
    let currentLastProfileUpdate = thisUpdateTimestamp

    this.peerData.forEach((info, key) => {
      if (info.identity === peerIdentity) {
        if (info.lastProfileUpdate < currentLastProfileUpdate) {
          this.removePeer(key)
        } else if (info.lastProfileUpdate > currentLastProfileUpdate) {
          this.removePeer(currentLastProfileAlias)
          currentLastProfileAlias = key
          currentLastProfileUpdate = info.lastProfileUpdate
        }
      }
    })

    return currentLastProfileAlias === fromAlias
  }

  removeMissingPeers(newPeers: MinPeerData[]) {
    for (const alias of this.peerData.keys()) {
      if (!newPeers.some((x) => x.id === alias)) {
        this.removePeer(alias)
      }
    }
  }

  removeAllPeers() {
    for (const alias of this.peerData.keys()) {
      this.removePeer(alias)
    }
  }

  removePeer(peerAlias: string) {
    this.peerData.delete(peerAlias)
    removeById(peerAlias)
    if (this.stats) {
      this.stats.onPeerRemoved(peerAlias)
    }
  }

  ensurePeerTrackingInfo(alias: string): PeerTrackingInfo {
    let peerTrackingInfo = this.peerData.get(alias)

    if (!peerTrackingInfo) {
      peerTrackingInfo = new PeerTrackingInfo()
      this.peerData.set(alias, peerTrackingInfo)
    }
    return peerTrackingInfo
  }

  private onPositionUpdate(p: Position) {
    const worldConnection = this.worldInstanceConnection

    if (!worldConnection) {
      return
    }

    const oldParcel = this.currentPosition ? position2parcel(this.currentPosition) : null
    const newParcel = position2parcel(p)
    const immediateReposition = p[7]

    if (!sameParcel(oldParcel, newParcel)) {
      const commArea = new CommunicationArea(newParcel, this.commRadius)

      const xMin = ((commArea.vMin.x + parcelLimits.maxParcelX) >> 2) << 2
      const xMax = ((commArea.vMax.x + parcelLimits.maxParcelX) >> 2) << 2
      const zMin = ((commArea.vMin.y + parcelLimits.maxParcelZ) >> 2) << 2
      const zMax = ((commArea.vMax.y + parcelLimits.maxParcelZ) >> 2) << 2

      const rawTopics: string[] = []
      for (let x = xMin; x <= xMax; x += 4) {
        for (let z = zMin; z <= zMax; z += 4) {
          const hash = `${x >> 2}:${z >> 2}`
          if (!rawTopics.includes(hash)) {
            rawTopics.push(hash)
          }
        }
      }
      this.currentParcelTopics = rawTopics.join(' ')
      if (this.currentPosition && !this.positionUpdatesPaused) {
        worldConnection
          .sendParcelUpdateMessage(this.currentPosition, p)
          .catch((e) => commsLogger.warn(`error while sending message `, e))
      }
    }

    if (!immediateReposition) {
      // Otherwise the topics get lost on an immediate reposition...
      const parcelSceneSubscriptions = getParcelSceneSubscriptions()
      const parcelSceneCommsTopics = parcelSceneSubscriptions.join(' ')

      const topics =
        (this.userInfo.userId ? this.userInfo.userId + ' ' : '') +
        this.currentParcelTopics +
        (parcelSceneCommsTopics.length ? ' ' + parcelSceneCommsTopics : '')

      if (topics !== this.previousTopics) {
        worldConnection
          .setTopics(topics.split(' '))
          .catch((e) => commsLogger.warn(`error while updating subscriptions`, e))
        this.previousTopics = topics
      }
    }

    this.currentPosition = p

    // set voicechat position params
    setListenerSpatialParams(this)

    const now = Date.now()
    const elapsed = now - this.lastNetworkUpdatePosition

    // We only send the same position message as a ping if we have not sent positions in the last 5 seconds
    if (!immediateReposition && arrayEquals(p, this.lastPositionSent) && elapsed < 5000) {
      return
    }

    if ((immediateReposition || elapsed > 100) && !this.positionUpdatesPaused) {
      this.lastPositionSent = p
      this.lastNetworkUpdatePosition = now
      worldConnection.sendPositionMessage(p).catch((e) => commsLogger.warn(`error while sending message `, e))
    }
  }

  private sendCurrentProfile() {
    if (this.currentPosition && this.worldInstanceConnection) {
      this.worldInstanceConnection
        .sendProfileMessage(this.currentPosition, this.userInfo)
        .catch((e) => commsLogger.warn(`error while sending message `, e))
    }
  }

  private onConnected() {
    this.worldRunningObserver = renderStateObservable.add(() => {
      if (!isRendererEnabled()) {
        this.sendToMordor().catch(commsLogger.error)
      }
    })

    this.positionObserver = positionObservable.add((obj: Readonly<PositionReport>) => {
      if (isRendererEnabled()) {
        this.onPositionUpdate(positionReportToCommsPosition(obj))
      }
    })

    this.infoCollecterInterval = setInterval(() => {
      this.collectInfo()
    }, 100)

    this.profileInterval = setInterval(() => {
      this.sendCurrentProfile()
    }, 1000)

    // send current profile and position right after connection
    this.sendCurrentProfile()
    if (lastPlayerPositionReport) {
      this.onPositionUpdate(positionReportToCommsPosition(lastPlayerPositionReport))
    }
  }

  private async sendToMordor() {
    if (this.worldInstanceConnection) {
      if (this.currentPosition) {
        await this.worldInstanceConnection.sendParcelUpdateMessage(this.currentPosition, MORDOR_POSITION)
      }
    }
  }

  private collectInfo() {
    if (this.stats) {
      this.stats.collectInfoDuration.start()
    }

    if (!this.currentPosition) {
      return
    }

    const now = Date.now()
    const visiblePeers: ProcessingPeerInfo[] = []
    const commsMetaConfig = getCommsConfig(store.getState())
    const commArea = new CommunicationArea(position2parcel(this.currentPosition), commConfigurations.commRadius)
    for (const [peerAlias, trackingInfo] of this.peerData) {
      const msSinceLastUpdate = now - trackingInfo.lastUpdate

      if (msSinceLastUpdate > commConfigurations.peerTtlMs) {
        this.removePeer(peerAlias)

        continue
      }

      if (trackingInfo.identity === getIdentity()?.address) {
        // If we are tracking a peer that is ourselves, we remove it
        this.removePeer(peerAlias)
        continue
      }

      if (!trackingInfo.position || !trackingInfo.userInfo) {
        continue
      }

      if (!commArea.contains(trackingInfo.position)) {
        receiveUserVisible(peerAlias, false)
        continue
      }

      visiblePeers.push({
        position: trackingInfo.position,
        userInfo: trackingInfo.userInfo,
        squareDistance: squareDistance(this.currentPosition, trackingInfo.position),
        alias: peerAlias,
        talking: trackingInfo.talking
      })
    }

    if (visiblePeers.length <= commsMetaConfig.maxVisiblePeers) {
      for (const peerInfo of visiblePeers) {
        const alias = peerInfo.alias
        receiveUserVisible(alias, true)
        receiveUserPose(alias, peerInfo.position as Pose)
        receiveUserData(alias, peerInfo.userInfo)
        receiveUserTalking(alias, peerInfo.talking)
      }
    } else {
      const sortedBySqDistanceVisiblePeers = visiblePeers.sort((p1, p2) => p1.squareDistance - p2.squareDistance)
      for (let i = 0; i < sortedBySqDistanceVisiblePeers.length; ++i) {
        const peer = sortedBySqDistanceVisiblePeers[i]
        const alias = peer.alias

        if (i < commsMetaConfig.maxVisiblePeers) {
          receiveUserVisible(alias, true)
          receiveUserPose(alias, peer.position as Pose)
          receiveUserData(alias, peer.userInfo)
          receiveUserTalking(alias, peer.talking)
        } else {
          receiveUserVisible(alias, false)
        }
      }
    }

    if (this.stats) {
      this.stats.visiblePeerIds = visiblePeers.map((it) => it.alias)
      this.stats.trackingPeersCount = this.peerData.size
      this.stats.collectInfoDuration.stop()
    }
  }
}

/**
 * Returns a list of CIDs that must receive scene messages from comms
 */
function getParcelSceneSubscriptions(): string[] {
  const ids: string[] = []

  scenesSubscribedToCommsEvents.forEach(($) => {
    ids.push($.cid)
  })

  return ids
}
