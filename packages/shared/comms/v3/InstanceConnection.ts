import { store } from 'shared/store/isolatedStore'
import { getCommsConfig } from 'shared/meta/selectors'
import { Position3D } from './types'
import * as rfc4 from '../comms-rfc-4.gen'
import { BFFConnection, TopicListener } from './BFFConnection'
import { TransportsConfig, Transport, DummyTransport, TransportMessage, createTransport } from '@dcl/comms3-transports'
import { createDummyLogger, createLogger } from 'shared/logger'
import { lastPlayerPositionReport, positionObservable } from 'shared/world/positionThings'
import { CommsEvents, RoomConnection } from '../../comms/interface/index'
import mitt from 'mitt'
import { Reader, Writer } from 'protobufjs/minimal'
import { HeartbeatMessage, LeftIslandMessage, IslandChangedMessage } from './proto/archipelago.gen'
import { DEBUG, DEBUG_COMMS } from 'config'

export type Config = {
  onPeerLeft: (peerId: string) => void
}

// we use a shared writer to reduce allocations and leverage its allocation pool
const writer = new Writer()
function craftMessage(packet: Partial<rfc4.Packet>): Uint8Array {
  writer.reset()
  rfc4.Packet.encode(packet as any, writer)
  return writer.finish()
}

export class InstanceConnection implements RoomConnection {
  events = mitt<CommsEvents>()

  private logger = createLogger('CommsV3: ')
  private transport: Transport = new DummyTransport()
  private heartBeatInterval: any = null
  private islandChangedListener: TopicListener | null = null
  private peerLeftListener: TopicListener | null = null
  private onPeerLeft: (peerId: string) => void

  constructor(private bff: BFFConnection, { onPeerLeft }: Config) {
    this.onPeerLeft = onPeerLeft
    this.bff.onTopicMessageObservable.add((topic) => this.logger.info('topic message', topic))
    this.bff.onDisconnectObservable.add(this.disconnect.bind(this))
  }

  async connect(): Promise<void> {
    const peerId = await this.bff.connect()
    const commsConfig = getCommsConfig(store.getState())
    const config: TransportsConfig = {
      logger: DEBUG || DEBUG_COMMS ? this.logger : createDummyLogger(),
      bff: this.bff,
      selfPosition: this.selfPosition,
      peerId,
      p2p: {
        verbose: DEBUG_COMMS,
        debugWebRtcEnabled: DEBUG_COMMS
      },
      livekit: {
        verbose: DEBUG_COMMS
      },
      ws: {
        verbose: DEBUG_COMMS
      }
    }

    if (!commsConfig.relaySuspensionDisabled) {
      config.p2p.relaySuspensionConfig = {
        relaySuspensionInterval: commsConfig.relaySuspensionInterval ?? 750,
        relaySuspensionDuration: commsConfig.relaySuspensionDuration ?? 5000
      }
    }

    const heartBeat = async () => {
      const position = this.selfPosition()
      if (position) {
        const d = HeartbeatMessage.encode({
          position: {
            x: position[0],
            y: position[1],
            z: position[2]
          }
        }).finish()
        try {
          await this.bff.publishToTopic('heartbeat', d)
        } catch (err: any) {
          this.logger.error(`Heartbeat failed ${err.toString()}`)
          await this.disconnect()
        }
      }
    }

    this.heartBeatInterval = setInterval(heartBeat, 2000)

    positionObservable.addOnce(() => heartBeat())

    this.islandChangedListener = await this.bff.addSystemTopicListener(
      `${peerId}.island_changed`,
      async (data: Uint8Array) => {
        let islandChangedMessage: IslandChangedMessage
        try {
          islandChangedMessage = IslandChangedMessage.decode(Reader.create(data))
        } catch (e) {
          this.logger.error('cannot process island change message', e)
          return
        }

        this.logger.log(`change island message ${islandChangedMessage.connStr}`)
        const transport = createTransport(config, islandChangedMessage)

        if (this.peerLeftListener) {
          await this.bff.removeSystemTopicListener(this.peerLeftListener)
        }
        this.peerLeftListener = await this.bff.addSystemTopicListener(
          `island.${islandChangedMessage.islandId}.peer_left`,
          async (data: Uint8Array) => {
            try {
              const peerLeftMessage = LeftIslandMessage.decode(Reader.create(data))
              this.onPeerLeft(peerLeftMessage.peerId)
            } catch (e) {
              this.logger.error('cannot process peer left message', e)
              return
            }
          }
        )

        if (!transport) {
          this.logger.error(`Invalid islandConnStr ${islandChangedMessage.connStr}`)
          return
        }
        await this.changeTransport(transport)
      }
    )
  }

  async sendPositionMessage(position: rfc4.Position) {
    return this.transport.send(craftMessage({ position }), { reliable: false })
  }

  async sendProfileMessage(profileVersion: rfc4.AnnounceProfileVersion) {
    return this.transport.send(craftMessage({ profileVersion }), { reliable: true, identity: true })
  }

  async sendProfileRequest(profileRequest: rfc4.ProfileRequest) {
    return this.transport.send(craftMessage({ profileRequest }), { reliable: true })
  }

  async sendProfileResponse(profileResponse: rfc4.ProfileResponse) {
    return this.transport.send(craftMessage({ profileResponse }), { reliable: true, identity: true })
  }

  async sendParcelSceneMessage(scene: rfc4.Scene) {
    return this.transport.send(craftMessage({ scene }), { reliable: false })
  }

  async sendChatMessage(chat: rfc4.Chat) {
    return this.transport.send(craftMessage({ chat }), { reliable: true, identity: true })
  }

  async sendVoiceMessage(voice: rfc4.Voice): Promise<void> {
    return this.transport.send(craftMessage({ voice }), { reliable: false })
  }

  async disconnect(): Promise<void> {
    if (this.islandChangedListener) {
      await this.bff.removeSystemTopicListener(this.islandChangedListener)
    }

    if (this.peerLeftListener) {
      await this.bff.removeSystemTopicListener(this.peerLeftListener)
    }

    if (this.heartBeatInterval) {
      clearInterval(this.heartBeatInterval)
    }

    if (this.transport) {
      await this.transport.disconnect()
      globalThis.__DEBUG_PEER = undefined
    }
    this.bff.disconnect()
    this.events.emit('DISCONNECTION')
  }

  protected handleTransportMessage({ peer, payload }: TransportMessage) {
    let data: rfc4.Packet
    try {
      data = rfc4.Packet.decode(Reader.create(payload))
    } catch (e: any) {
      this.logger.error(`cannot decode topic message data ${e.toString()}`)
      return
    }

    // TODO: fix new Date().getTime()

    if (data.position) {
      this.events.emit('position', {
        address: peer,
        time: new Date().getTime(),
        data: data.position
      })

      // MENDEZ: Why is this necessary and not an internal thing of the transport?
      this.transport.onPeerPositionChange(peer, [
        data.position.positionX,
        data.position.positionY,
        data.position.positionZ
      ])
    } else if (data.voice) {
      this.events.emit('voiceMessage', {
        address: peer,
        time: new Date().getTime(),
        data: data.voice
      })
    } else if (data.profileVersion) {
      this.events.emit('profileMessage', {
        address: peer,
        time: new Date().getTime(),
        data: data.profileVersion
      })
    } else if (data.chat) {
      this.events.emit('chatMessage', {
        address: peer,
        time: new Date().getTime(),
        data: data.chat
      })
    } else if (data.profileRequest) {
      this.events.emit('profileRequest', {
        address: peer,
        time: new Date().getTime(),
        data: data.profileRequest
      })
    } else if (data.profileResponse) {
      this.events.emit('profileResponse', {
        address: peer,
        time: new Date().getTime(),
        data: data.profileResponse
      })
    } else {
      this.logger.log(`Ignoring unknown comms message ${data}`)
    }
  }

  private async changeTransport(transport: Transport): Promise<void> {
    const oldTransport = this.transport

    await transport.connect()

    transport.onMessageObservable.add(this.handleTransportMessage.bind(this))
    transport.onDisconnectObservable.add(this.disconnect.bind(this))

    this.transport = transport

    globalThis.__DEBUG_PEER = transport

    if (oldTransport) {
      oldTransport.onMessageObservable.clear()
      oldTransport.onDisconnectObservable.clear()
      await oldTransport.disconnect()
    }
  }

  private selfPosition(): Position3D | undefined {
    if (lastPlayerPositionReport) {
      const { x, y, z } = lastPlayerPositionReport.position
      return [x, y, z]
    }
  }
}
