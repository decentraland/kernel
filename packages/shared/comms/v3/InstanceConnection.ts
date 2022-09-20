import { store } from 'shared/store/isolatedStore'
import { getCommsConfig } from 'shared/meta/selectors'
import { Position3D } from './types'
import * as rfc4 from 'shared/protocol/kernel/comms/comms-rfc-4.gen'
import { BFFConnection, TopicListener } from './BFFConnection'
import { TransportsConfig, Transport, DummyTransport, TransportMessage, createTransport } from '@dcl/comms3-transports'
import { createLogger } from 'shared/logger'
import { lastPlayerPositionReport, positionObservable } from 'shared/world/positionThings'
import { CommsEvents, RoomConnection } from '../../comms/interface/index'
import mitt from 'mitt'
import { Reader, Writer } from 'protobufjs/minimal'
import {
  HeartbeatMessage,
  LeftIslandMessage,
  IslandChangedMessage
} from 'shared/protocol/kernel/comms/v3/archipelago.gen'
import { DEBUG, DEBUG_COMMS } from 'config'

// we use a shared writer to reduce allocations and leverage its allocation pool
const writer = new Writer()
function craftMessage(packet: rfc4.Packet): Uint8Array {
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
  private positionIndex = 0

  constructor(private bff: BFFConnection) {
    this.bff.onDisconnectObservable.add(this.disconnect.bind(this))
  }

  async connect(): Promise<void> {
    const peerId = await this.bff.connect()
    const commsConfig = getCommsConfig(store.getState())
    const debug = DEBUG || DEBUG_COMMS
    const config: TransportsConfig = {
      logger: this.logger,
      bff: this.bff,
      selfPosition: this.selfPosition,
      peerId,
      p2p: {
        debugUpdateNetwork: debug,
        debugWebRtcEnabled: debug
      },
      livekit: {
        verbose: debug
      },
      ws: {
        verbose: debug
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
              this.events.emit('PEER_DISCONNECTED', { address: peerLeftMessage.peerId })
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
    position.index = this.positionIndex++
    return this.transport.send(craftMessage({ message: { $case: 'position', position } }), { reliable: false })
  }

  async sendProfileMessage(profileVersion: rfc4.AnnounceProfileVersion) {
    return this.transport.send(craftMessage({ message: { $case: 'profileVersion', profileVersion } }), {
      reliable: true
    })
  }

  async sendProfileRequest(profileRequest: rfc4.ProfileRequest) {
    return this.transport.send(craftMessage({ message: { $case: 'profileRequest', profileRequest } }), {
      reliable: true
    })
  }

  async sendProfileResponse(profileResponse: rfc4.ProfileResponse) {
    return this.transport.send(craftMessage({ message: { $case: 'profileResponse', profileResponse } }), {
      reliable: true
    })
  }

  async sendParcelSceneMessage(scene: rfc4.Scene) {
    return this.transport.send(craftMessage({ message: { $case: 'scene', scene } }), { reliable: false })
  }

  async sendChatMessage(chat: rfc4.Chat) {
    return this.transport.send(craftMessage({ message: { $case: 'chat', chat } }), { reliable: true })
  }

  async sendVoiceMessage(voice: rfc4.Voice): Promise<void> {
    return this.transport.send(craftMessage({ message: { $case: 'voice', voice } }), { reliable: false })
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
    this.events.emit('DISCONNECTION', { kicked: false })
  }

  protected handleTransportMessage({ peer, payload }: TransportMessage) {
    let packet: rfc4.Packet
    try {
      packet = rfc4.Packet.decode(Reader.create(payload))
    } catch (e: any) {
      this.logger.error(`cannot decode topic message data ${e.toString()}`)
      return
    }

    const { message } = packet

    if (!message) {
      return
    }

    switch (message!.$case) {
      case 'position': {
        const { position } = message
        this.events.emit('position', {
          address: peer,
          time: Date.now(),
          data: position
        })

        // MENDEZ: Why is this necessary and not an internal thing of the transport?
        this.transport.onPeerPositionChange(peer, [position.positionX, position.positionY, position.positionZ])
        break
      }
      case 'voice': {
        const { voice } = message
        this.events.emit('voiceMessage', {
          address: peer,
          time: Date.now(),
          data: voice
        })
        break
      }
      case 'profileVersion': {
        this.events.emit('profileMessage', {
          address: peer,
          time: Date.now(),
          data: message.profileVersion
        })
        break
      }
      case 'chat': {
        this.events.emit('chatMessage', {
          address: peer,
          time: Date.now(),
          data: message.chat
        })
        break
      }
      case 'profileRequest': {
        this.events.emit('profileRequest', {
          address: peer,
          time: Date.now(),
          data: message.profileRequest
        })
        break
      }
      case 'profileResponse': {
        this.events.emit('profileResponse', {
          address: peer,
          time: Date.now(),
          data: message.profileResponse
        })
        break
      }
      default: {
        this.logger.log(`Ignoring unknown comms message ${packet}`)
      }
    }
  }

  private async changeTransport(transport: Transport): Promise<void> {
    const oldTransport = this.transport

    await transport.connect()

    transport.onMessageObservable.add(this.handleTransportMessage.bind(this))
    transport.onDisconnectObservable.add(this.disconnect.bind(this))

    // TODO: MENDEZ: should transport.onPeerPositionChange be called here?
    // TODO: MENDEZ: we should bind peerLeft messages to this.events.emit('PEER_DISCONNECTED', { address })
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
