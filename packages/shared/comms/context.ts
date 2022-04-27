import { commConfigurations, parcelLimits } from 'config'
import { lastPlayerPositionReport, positionObservable, PositionReport } from 'shared/world/positionThings'
import { Stats } from './debug'
import { removeAllPeers } from './peers'
import {
  CommunicationArea,
  Position,
  position2parcel,
  positionReportToCommsPosition,
  sameParcel
} from './interface/utils'
import { renderStateObservable } from '../world/worldState'
import { RoomConnection } from './interface/index'
import { createLogger } from '../logger'
import { Observable, Observer } from 'mz-observable'
import { setListenerSpatialParams } from './voice-over-comms'
import { scenesSubscribedToCommsEvents } from './handlers'
import { arrayEquals } from 'atomicHelpers/arrayEquals'
import { Realm } from 'shared/dao/types'
import { Avatar } from '@dcl/schemas'
import { ProfileType } from 'shared/profiles/types'

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
  squareDistance: number
}

export const commsLogger = createLogger('comms: ')

export type ProfilePromiseState = {
  promise: Promise<Avatar | void>
  version: number | null
  status: 'ok' | 'loading' | 'error'
}

export class CommsContext {
  public readonly stats: Stats = new Stats()
  public commRadius: number

  public currentPosition: Position | null = null

  public onDisconnectObservable = new Observable<void>()

  timeToChangeRealm: number = Date.now() + commConfigurations.autoChangeRealmInterval
  sendingProfileResponse: boolean = false
  positionUpdatesPaused: boolean = false

  private reportPositionInterval?: ReturnType<typeof setInterval>
  private positionObserver: Observer<any> | null = null
  private worldRunningObserver?: Observer<any> | null = null

  private currentParcelTopics = ''
  private previousTopics = ''

  private lastNetworkUpdatePosition = new Date().getTime()
  private lastPositionSent: Position | undefined
  private destroyed = false

  constructor(
    public readonly realm: Realm,
    public readonly userAddress: string,
    public readonly profileType: ProfileType,
    public readonly worldInstanceConnection: RoomConnection
  ) {
    this.commRadius = commConfigurations.commRadius

    this.worldInstanceConnection.events.on('DISCONNECTION', () => this.disconnect())
  }

  async connect(): Promise<boolean> {
    try {
      await this.worldInstanceConnection.connect()

      this.worldRunningObserver = renderStateObservable.add(() => {
        // TODO:
        // this.sendCellphonePose(!isRendererEnabled())
      })

      this.positionObserver = positionObservable.add((obj: Readonly<PositionReport>) => {
        this.onPositionUpdate(positionReportToCommsPosition(obj))
      })

      // this interval is important because if we stand still without sending position reports
      // then archipelago may timeout and peers may magically stop appearing for us. fixable with
      // walking one centimeter in any direction. don't know the reason
      this.reportPositionInterval = setInterval(() => {
        if (lastPlayerPositionReport) {
          this.onPositionUpdate(positionReportToCommsPosition(lastPlayerPositionReport))
        }
      }, 5001)
      return true
    } catch (e: any) {
      await this.disconnect()
      return false
    }
  }

  async disconnect() {
    if (this.destroyed) return
    await this.sendToMordor()

    commsLogger.info('Disconnecting comms context')
    this.destroyed = true
    this.onDisconnectObservable.notifyObservers()
    this.positionUpdatesPaused = true

    await this.worldInstanceConnection.disconnect()

    removeAllPeers()

    if (this.reportPositionInterval) {
      clearInterval(this.reportPositionInterval)
    }
    if (this.positionObserver) {
      positionObservable.remove(this.positionObserver)
    }
    if (this.worldRunningObserver) {
      renderStateObservable.remove(this.worldRunningObserver)
    }
  }

  public sendCurrentProfile(version: number) {
    if (lastPlayerPositionReport) {
      const pos = positionReportToCommsPosition(lastPlayerPositionReport)
      this.onPositionUpdate(pos, true)
      this.worldInstanceConnection
        .sendProfileMessage(pos, this.userAddress, this.profileType, version)
        .catch((e) => commsLogger.warn(`error in sendCurrentProfile `, e))
    }
  }

  private onPositionUpdate(newPosition: Position, force: boolean = false) {
    const worldConnection = this.worldInstanceConnection

    if (!worldConnection) {
      return
    }

    const oldParcel = this.currentPosition ? position2parcel(this.currentPosition) : null
    const oldPosition = this.currentPosition

    this.currentPosition = newPosition

    const newParcel = position2parcel(newPosition)
    const immediateReposition = newPosition[7] || force

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
      if (!this.positionUpdatesPaused) {
        worldConnection
          .sendParcelUpdateMessage(oldPosition || newPosition, newPosition)
          .catch((e) => commsLogger.warn(`error while sending message `, e))
      }
    }

    if (!immediateReposition) {
      // Otherwise the topics get lost on an immediate reposition...
      const parcelSceneSubscriptions = getParcelSceneSubscriptions()
      const parcelSceneCommsTopics = parcelSceneSubscriptions.join(' ')

      const topics =
        this.userAddress +
        ' ' +
        this.currentParcelTopics +
        (parcelSceneCommsTopics.length ? ' ' + parcelSceneCommsTopics : '')

      if (topics !== this.previousTopics) {
        worldConnection
          .setTopics(topics.split(' '))
          .catch((e) => commsLogger.warn(`error while updating subscriptions`, e))
        this.previousTopics = topics
      }
    }

    // set voicechat position params
    setListenerSpatialParams(this)

    const now = Date.now()
    const elapsed = now - this.lastNetworkUpdatePosition

    // We only send the same position message as a ping if we have not sent positions in the last 5 seconds
    if (!immediateReposition && arrayEquals(newPosition, this.lastPositionSent) && elapsed < 5000) {
      return
    }

    if ((immediateReposition || elapsed > 100) && !this.positionUpdatesPaused) {
      this.lastPositionSent = newPosition
      this.lastNetworkUpdatePosition = now
      worldConnection.sendPositionMessage(newPosition).catch((e) => commsLogger.warn(`error while sending message `, e))
    }
  }

  private async sendToMordor() {
    let pos = this.currentPosition
    if (lastPlayerPositionReport) pos = positionReportToCommsPosition(lastPlayerPositionReport)
    if (pos) {
      await this.worldInstanceConnection.sendParcelUpdateMessage(pos, MORDOR_POSITION)
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
