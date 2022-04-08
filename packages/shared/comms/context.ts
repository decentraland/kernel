import { commConfigurations, parcelLimits } from 'config'
import { lastPlayerPositionReport, positionObservable, PositionReport } from 'shared/world/positionThings'
import { Stats } from './debug'
import {
  receiveUserData,
  receiveUserPose,
  receiveUserVisible,
  removeById,
  receiveUserTalking,
  PeerTrackingInfo
} from './peers'
import { ConnectionEstablishmentError, Pose, UserInformation } from './interface/types'
import {
  CommunicationArea,
  Position,
  position2parcel,
  positionReportToCommsPosition,
  sameParcel,
  squareDistance
} from './interface/utils'
import { isRendererEnabled, renderStateObservable } from '../world/worldState'
import { WorldInstanceConnection } from './interface/index'
import { store } from 'shared/store/isolatedStore'
import { getCommsConfig } from 'shared/meta/selectors'
import { getIdentity } from 'shared/session'
import { createLogger } from '../logger'
import { MinPeerData } from '@dcl/catalyst-peer'
import { Observer } from 'decentraland-ecs'
import { setListenerSpatialParams } from './voice-over-comms'
import { scenesSubscribedToCommsEvents } from './handlers'
import { arrayEquals } from 'atomicHelpers/arrayEquals'
import { commsErrorRetrying } from 'shared/loading/types'
import { trackEvent } from 'shared/analytics'
import { sleep } from 'atomicHelpers/sleep'
import { getRealm } from 'shared/dao/selectors'
import { markCatalystRealmConnectionError } from 'shared/dao/actions'

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

export class CommsContext {
  public readonly stats: Stats = new Stats()
  public commRadius: number

  public peerData = new Map<PeerAlias, PeerTrackingInfo>()
  public userInfo: UserInformation

  public currentPosition: Position | null = null

  public worldInstanceConnection: WorldInstanceConnection | null = null

  timeToChangeRealm: number = Date.now() + commConfigurations.autoChangeRealmInterval
  lastProfileResponseTime: number = 0
  sendingProfileResponse: boolean = false
  positionUpdatesPaused: boolean = false

  private profileInterval?: ReturnType<typeof setInterval>
  private analyticsInterval?: ReturnType<typeof setInterval>
  private positionObserver: Observer<any> | null = null
  private worldRunningObserver?: Observer<any> | null = null
  private infoCollecterInterval?: ReturnType<typeof setInterval>
  private idTaken = false

  private currentParcelTopics = ''
  private previousTopics = ''

  private lastNetworkUpdatePosition = new Date().getTime()
  private lastPositionSent: Position | undefined

  constructor(userInfo: UserInformation) {
    this.userInfo = userInfo

    this.commRadius = commConfigurations.commRadius
  }

  async connect(connection: WorldInstanceConnection) {
    this.worldInstanceConnection = connection

    this.idTaken = false
    await this.connectWithRetries()

    this.onConnected()
  }

  async disconnect() {
    commsLogger.info('Disconnecting comms context')
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
      const zMin = ((commArea.vMin.z + parcelLimits.maxParcelZ) >> 2) << 2
      const zMax = ((commArea.vMax.z + parcelLimits.maxParcelZ) >> 2) << 2

      let rawTopics: string[] = []
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

    if (commConfigurations.sendAnalytics) {
      this.analyticsInterval = setInterval(() => {
        if (!this.worldInstanceConnection) return

        const connectionAnalytics = this.worldInstanceConnection.analyticsData()
        // We slice the ids in order to reduce the potential event size. Eventually, we should slice all comms ids
        connectionAnalytics.trackedPeers = this?.peerData.keys()
          ? [...this.peerData.keys()].map((it) => it.slice(-6))
          : []
        connectionAnalytics.visiblePeers = this?.stats.visiblePeerIds.map((it) => it.slice(-6))

        if (connectionAnalytics) {
          trackEvent('Comms Status v2', connectionAnalytics)
        }
      }, 60000) // Once per minute
    }
  }

  private async connectWithRetries() {
    const maxAttemps = 5
    for (let i = 1; ; ++i) {
      try {
        if (this.idTaken) break

        commsLogger.info(`Attempt number ${i}...`)
        await this.worldInstanceConnection!.connect()

        break
      } catch (e) {
        if (e instanceof ConnectionEstablishmentError) {
          if (i >= maxAttemps) {
            // max number of attemps reached => rethrow error
            commsLogger.info(`Max number of attemps reached (${maxAttemps}), unsuccessful connection`)
            throw e
          } else {
            await sleep(Math.random() * 2000 + 250)
            // max number of attempts not reached => continue with loop
            store.dispatch(commsErrorRetrying(i))
          }
        } else {
          // not a comms issue per se => rethrow error
          commsLogger.error(`error while trying to establish communications `, e)
          const realm = getRealm(store.getState())
          if (realm) {
            store.dispatch(markCatalystRealmConnectionError(realm))
          }
        }
      }
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
    for (let [peerAlias, trackingInfo] of this.peerData) {
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
      for (let peerInfo of visiblePeers) {
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
  let ids: string[] = []

  scenesSubscribedToCommsEvents.forEach(($) => {
    ids.push($.cid)
  })

  return ids
}
