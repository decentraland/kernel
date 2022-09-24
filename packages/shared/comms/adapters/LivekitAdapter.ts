import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Participant,
  DataPacket_Kind,
  DisconnectReason
} from 'livekit-client'
import mitt from 'mitt'
import { ILogger } from 'shared/logger'
import { incrementCommsMessageSent } from 'shared/session/getPerformanceInfo'
import { commsLogger } from '../context'
import { CommsAdapterEvents, MinimumCommunicationsAdapter, SendHints } from './types'

export type LivekitConfig = {
  url: string
  token: string
  logger: ILogger
}

export class LivekitAdapter implements MinimumCommunicationsAdapter {
  public readonly events = mitt<CommsAdapterEvents>()

  private disconnected = false
  private room: Room

  constructor(private config: LivekitConfig) {
    this.room = new Room()

    this.room
      .on(RoomEvent.TrackSubscribed, (_: RemoteTrack, __: RemoteTrackPublication, ___: RemoteParticipant) => {
        this.config.logger.log('track subscribed')
      })
      .on(RoomEvent.TrackUnsubscribed, (_: RemoteTrack, __: RemoteTrackPublication, ___: RemoteParticipant) => {
        this.config.logger.log('track unsubscribed')
      })
      .on(RoomEvent.ParticipantDisconnected, (_: RemoteParticipant) => {
        this.events.emit('PEER_DISCONNECTED', {
          address: _.identity
        })
        this.config.logger.log('remote participant left')
      })
      .on(RoomEvent.Disconnected, (_reason: DisconnectReason | undefined) => {
        this.config.logger.log('disconnected from room')
        this.disconnect().catch((err) => {
          this.config.logger.error(`error during disconnection ${err.toString()}`)
        })
      })
      .on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: Participant, _?: DataPacket_Kind) => {
        if (participant) {
          this.handleMessage(participant.identity, payload)
        }
      })
  }

  async connect(): Promise<void> {
    await this.room.connect(this.config.url, this.config.token, { autoSubscribe: true })
    this.config.logger.log(`Connected to livekit room ${this.room.name}`)
  }

  send(data: Uint8Array, { reliable }: SendHints): Promise<void> {
    incrementCommsMessageSent(data.length)
    return this.room.localParticipant.publishData(data, reliable ? DataPacket_Kind.RELIABLE : DataPacket_Kind.LOSSY)
  }

  async disconnect() {
    if (this.disconnected) {
      return
    }

    this.disconnected = true
    this.room.disconnect().catch(commsLogger.error)
    this.events.emit('DISCONNECTION', { kicked: false })
  }

  handleMessage(address: string, data: Uint8Array) {
    this.events.emit('message', {
      address,
      data
    })
  }
}
