import { DEBUG_COMMS } from 'config'
import { lastPlayerPositionReport, positionObservable, PositionReport } from 'shared/world/positionThings'
import { positionReportToCommsPositionRfc4 } from './interface/utils'
import { RoomConnection } from './interface/index'
import { createLogger } from '../logger'
import { Observer } from 'mz-observable'
import { Realm } from 'shared/dao/types'
import { Avatar } from '@dcl/schemas'
import { ProfileType } from 'shared/profiles/types'
import { incrementCommsMessageReceived, incrementCommsMessageReceivedByName } from 'shared/session/getPerformanceInfo'
import { incrementCounter } from 'shared/occurences'
import { MORDOR_POSITION_RFC4 } from './const'
import * as rfc4 from 'shared/protocol/kernel/comms/comms-rfc-4.gen'
import { deepEqual } from 'atomicHelpers/deepEqual'

export const commsLogger = createLogger('comms: ')

export type ProfilePromiseState = {
  promise: Promise<Avatar | void>
  version: number | null
  status: 'ok' | 'loading' | 'error'
}

const commsEventsLogger = createLogger('CommsEvents:')

export class CommsContext {
  public currentPosition: rfc4.Position | null = null

  private reportPositionInterval?: ReturnType<typeof setInterval>
  private positionObserver: Observer<any> | null = null

  private lastNetworkUpdatePosition = new Date().getTime()
  private lastPositionSent: rfc4.Position | undefined
  private destroyed = false

  constructor(
    public readonly realm: Realm,
    public readonly userAddress: string,
    public readonly profileType: ProfileType,
    public readonly worldInstanceConnection: RoomConnection
  ) {
    this.worldInstanceConnection.events.on('*', (type, _) => {
      incrementCommsMessageReceived()
      incrementCommsMessageReceivedByName(type)
      if (DEBUG_COMMS) {
        commsEventsLogger.info(type, _)
      }
    })

    this.worldInstanceConnection.events.on('DISCONNECTION', () => this.disconnect())

    // this.worldRunningObserver = renderStateObservable.add(() => {
    // TODO:
    // this.sendCellphonePose(!isRendererEnabled())
    // })

    this.positionObserver = positionObservable.add((obj: Readonly<PositionReport>) => {
      if (!this.destroyed) {
        this.onPositionUpdate(positionReportToCommsPositionRfc4(obj))
      }
    })

    if (lastPlayerPositionReport) this.onPositionUpdate(positionReportToCommsPositionRfc4(lastPlayerPositionReport))

    // this interval is important because if we stand still without sending position reports
    // then archipelago may timeout and peers may magically stop appearing for us. fixable with
    // walking one centimeter in any direction. don't know the reason
    this.reportPositionInterval = setInterval(() => {
      if (this.currentPosition && !this.destroyed) {
        this.onPositionUpdate(this.currentPosition)
      }
    }, 1100)
  }

  async connect() {
    await this.worldInstanceConnection.connect()
  }

  async disconnect() {
    if (this.destroyed) return
    await this.sendToMordor()

    commsLogger.info('Disconnecting comms context', this)
    this.destroyed = true

    await this.worldInstanceConnection.disconnect()

    if (this.reportPositionInterval) {
      clearInterval(this.reportPositionInterval)
    }
    if (this.positionObserver) {
      positionObservable.remove(this.positionObserver)
    }
  }

  public sendCurrentProfile(profileVersion: number) {
    // send the profile and immediately after send the position
    this.worldInstanceConnection
      .sendProfileMessage({ profileVersion })
      .then(() => {
        if (this.currentPosition) {
          this.onPositionUpdate(this.currentPosition, true)
        }
      })
      .catch((e) => commsLogger.warn(`error in sendCurrentProfile `, e))
  }

  private onPositionUpdate(newPosition: rfc4.Position, immediateReposition: boolean = false) {
    const worldConnection = this.worldInstanceConnection

    if (!worldConnection) {
      return
    }

    this.currentPosition = newPosition

    const now = Date.now()
    const elapsed = now - this.lastNetworkUpdatePosition

    // We only send the same position message as a ping if we have not sent positions in the last 1 second
    if (!immediateReposition && deepEqual(newPosition, this.lastPositionSent) && elapsed < 1000) {
      return
    }

    if ((immediateReposition || elapsed > 100) && !this.destroyed) {
      this.lastPositionSent = newPosition
      this.lastNetworkUpdatePosition = now
      worldConnection.sendPositionMessage(newPosition).catch((e) => {
        incrementCounter('failed:sendPositionMessage')
        commsLogger.warn(`error while sending message `, e)
      })
    }
  }

  private async sendToMordor() {
    await this.worldInstanceConnection.sendPositionMessage(MORDOR_POSITION_RFC4)
  }
}
