/// <reference lib="dom" />

import { Position3D } from './types'
import { Data, Profile_ProfileType } from './proto/comms'
import { Position } from '../../comms/interface/utils'
import { BFFConnection, TopicData, SystemTopicListener } from './BFFConnection'
import { WsTransport } from './WsTransport'
import { LivekitTransport } from './LivekitTransport'
import { Transport, TransportMessage } from './Transport'
import { createLogger } from 'shared/logger'
import { lastPlayerPositionReport } from 'shared/world/positionThings'

import { PeerToPeerTransport } from './PeerToPeerTransport'
import { CommsEvents, RoomConnection } from '../../comms/interface/index'
import { ProfileType } from 'shared/profiles/types'
import { EncodedFrame } from 'voice-chat-codec/types'
import mitt from 'mitt'
import { DummyTransport } from './DummyTransport'
import { Avatar } from '@dcl/schemas'
import { Reader } from 'protobufjs/minimal'
import { HeartbeatMessage, IslandChangedMessage, Position3DMessage } from './proto/archipelago_pb'

export class InstanceConnection implements RoomConnection {
  events = mitt<CommsEvents>()

  private logger = createLogger('CommsV4: ')
  private transport: Transport = new DummyTransport()
  private heartBeatInterval: any = null
  private islandChangedListener: SystemTopicListener | null = null

  constructor(private bff: BFFConnection) {
    this.bff.onTopicMessageObservable.add(this.handleTopicMessage.bind(this))
    this.bff.onDisconnectObservable.add(this.disconnect.bind(this))
  }

  async connect(): Promise<void> {
    const peerId = await this.bff.connect()

    this.heartBeatInterval = setInterval(async () => {
      const positionMessage = new Position3DMessage()

      const position = this.selfPosition()
      if (position) {
        positionMessage.setX(position[0])
        positionMessage.setY(position[1])
        positionMessage.setZ(position[2])
        const msg = new HeartbeatMessage()
        msg.setPosition(positionMessage)
        try {
          await this.bff.publishToTopic('heartbeat', msg.serializeBinary())
        } catch (err: any) {
          this.logger.error(`Heartbeat failed ${err.toString()}`)
          this.disconnect()
        }
      }
    }, 2000)

    this.islandChangedListener = this.bff.addSystemTopicListener(
      `${peerId}.island_changed`,
      async (data: Uint8Array) => {
        let islandChangedMessage: IslandChangedMessage

        try {
          islandChangedMessage = IslandChangedMessage.deserializeBinary(data)
        } catch (e) {
          this.logger.error('cannot process island change message', e)
          return
        }
        const connStr = islandChangedMessage.getConnStr()
        this.logger.info(`Got island change message: ${connStr}`)

        let transport: Transport | null = null
        if (connStr.startsWith('ws-room:')) {
          transport = new WsTransport(connStr.substring('ws-room:'.length))
        } else if (connStr.startsWith('livekit:')) {
          transport = new LivekitTransport(connStr.substring('livekit:'.length))
        } else if (connStr.startsWith('p2p:')) {
          const islandId = islandChangedMessage.getIslandId()

          const peers = new Map<string, Position3D>()
          islandChangedMessage.getPeersMap().forEach((p: Position3DMessage, id: string) => {
            if (peerId !== id) {
              peers.set(id, [p.getX(), p.getY(), p.getZ()])
            }
          })
          transport = new PeerToPeerTransport(peerId, this.bff, islandId, peers)
        }

        if (!transport) {
          this.logger.error(`Invalid islandConnStr ${connStr}`)
          return
        }
        await this.changeTransport(transport)
      }
    )
  }

  async sendPositionMessage(p: Position) {
    const d = Data.encode({
      message: {
        $case: 'position',
        position: {
          time: Date.now(),
          positionX: p[0],
          positionY: p[1],
          positionZ: p[2],
          rotationX: p[3],
          rotationY: p[4],
          rotationZ: p[5],
          rotationW: p[6]
        }
      }
    }).finish()

    return this.transport.send(d, { reliable: false })
  }

  async sendParcelUpdateMessage(_: Position, _newPosition: Position) {}

  async sendProfileMessage(_: Position, __: string, profileType: ProfileType, version: number) {
    const d = Data.encode({
      message: {
        $case: 'profile',
        profile: {
          time: Date.now(),
          profileType: profileType === ProfileType.LOCAL ? Profile_ProfileType.LOCAL : Profile_ProfileType.DEPLOYED,
          profileVersion: `${version}`
        }
      }
    }).finish()

    return this.transport.send(d, { reliable: true, identity: true })
  }

  async sendProfileRequest(_: Position, userId: string, version: number | undefined) {
    const d = Data.encode({
      message: {
        $case: 'profileRequest',
        profileRequest: {
          time: Date.now(),
          userId: userId,
          profileVersion: `${version}`
        }
      }
    }).finish()

    return this.transport.send(d, { reliable: true, identity: true })
  }

  async sendProfileResponse(_: Position, profile: Avatar) {
    const d = Data.encode({
      message: {
        $case: 'profileResponse',
        profileResponse: {
          time: Date.now(),
          serializedProfile: JSON.stringify(profile)
        }
      }
    }).finish()

    return this.transport.send(d, { reliable: true, identity: true })
  }

  async sendInitialMessage(_: string, profileType: ProfileType) {
    const d = Data.encode({
      message: {
        $case: 'profile',
        profile: {
          time: Date.now(),
          profileType: profileType === ProfileType.LOCAL ? Profile_ProfileType.LOCAL : Profile_ProfileType.DEPLOYED,
          profileVersion: ''
        }
      }
    }).finish()

    return this.transport.send(d, { reliable: true, identity: true })
  }

  async sendParcelSceneCommsMessage(sceneId: string, message: string) {
    const d = Data.encode({
      message: {
        $case: 'scene',
        scene: {
          time: Date.now(),
          sceneId: sceneId,
          data: message
        }
      }
    }).finish()

    return this.bff.publishToTopic(sceneId, d)
  }

  async sendChatMessage(_: Position, messageId: string, text: string) {
    const d = Data.encode({
      message: {
        $case: 'chat',
        chat: {
          time: Date.now(),
          messageId,
          text
        }
      }
    }).finish()
    return this.transport.send(d, { reliable: true })
  }

  async setTopics(topics: string[]) {
    return this.bff.setTopics(topics)
  }

  async disconnect(): Promise<void> {
    if (this.islandChangedListener) {
      this.bff.removeSystemTopicListener(this.islandChangedListener)
    }

    if (this.heartBeatInterval) {
      clearInterval(this.heartBeatInterval)
    }

    if (this.transport) {
      await this.transport.disconnect()
    }
    return this.bff.disconnect()
  }

  async sendVoiceMessage(_: Position, frame: EncodedFrame): Promise<void> {
    const d = Data.encode({
      message: {
        $case: 'voice',
        voice: {
          encodedSamples: frame.encoded,
          index: frame.index
        }
      }
    }).finish()

    return this.transport.send(d, { reliable: true })
  }

  protected handleTopicMessage(message: TopicData) {
    let data: Data
    try {
      data = Data.decode(Reader.create(message.data))
    } catch (e: any) {
      this.logger.error(`cannot decode topic message data ${e.toString()}`)
      return
    }

    switch (data.message?.$case) {
      case 'scene': {
        const sceneData = data.message?.scene

        this.events.emit('sceneMessageBus', {
          sender: message.peerId,
          time: sceneData.time,
          data: {
            id: sceneData.sceneId,
            text: sceneData.data
          }
        })
        break
      }
      default: {
        this.logger.log(`Ignoring category ${data.message?.$case}`)
        break
      }
    }
  }

  protected handleTransportMessage({ peer, payload }: TransportMessage) {
    let data: Data
    try {
      data = Data.decode(Reader.create(payload))
    } catch (e: any) {
      this.logger.error(`cannot decode topic message data ${e.toString()}`)
      return
    }

    if (!data.message) {
      this.logger.error(`Transport message has no content`)
      return
    }

    const { $case } = data.message

    switch ($case) {
      case 'position': {
        const { position } = data.message
        this.events.emit('position', {
          sender: peer,
          time: position.time,
          data: [
            position.positionX,
            position.positionY,
            position.positionZ,
            position.rotationX,
            position.rotationY,
            position.rotationZ,
            position.rotationW,
            false
          ]
        })

        this.transport.onPeerPositionChange(peer, [position.positionX, position.positionY, position.positionZ])
        break
      }
      case 'chat': {
        const { time, messageId, text } = data.message.chat

        this.events.emit('chatMessage', {
          sender: peer,
          time: time,
          data: {
            id: messageId,
            text: text
          }
        })
        break
      }
      case 'voice': {
        const { encodedSamples, index } = data.message.voice

        this.events.emit('voiceMessage', {
          sender: peer,
          time: new Date().getTime(),
          data: {
            encoded: encodedSamples,
            index
          }
        })
        break
      }
      case 'profile': {
        const { time, profileVersion, profileType } = data.message.profile
        this.events.emit('profileMessage', {
          sender: peer,
          time: time,
          data: {
            user: peer,
            version: profileVersion,
            type: profileType === Profile_ProfileType.LOCAL ? ProfileType.LOCAL : ProfileType.DEPLOYED
          } // We use deployed as default because that way we can emulate the old behaviour
        })
        break
      }
      case 'profileRequest': {
        const { userId, time, profileVersion } = data.message.profileRequest
        this.events.emit('profileRequest', {
          sender: peer,
          time: time,
          data: {
            userId: userId,
            version: profileVersion
          }
        })
        break
      }
      case 'profileResponse': {
        const { time, serializedProfile } = data.message.profileResponse
        this.events.emit('profileResponse', {
          sender: peer,
          time: time,
          data: {
            profile: JSON.parse(serializedProfile) as Avatar
          }
        })
        break
      }
      default: {
        this.logger.log(`Ignoring category ${$case}`)
        break
      }
    }
  }

  private async changeTransport(transport: Transport): Promise<void> {
    const oldTransport = this.transport

    await transport.connect()
    transport.onMessageObservable.add(this.handleTransportMessage.bind(this))
    transport.onDisconnectObservable.add(this.disconnect.bind(this))

    this.transport = transport

    if (oldTransport) {
      oldTransport.onMessageObservable.clear()
      oldTransport.onDisconnectObservable.clear()
      await oldTransport.disconnect()
    }
  }

  private selfPosition(): Position3D | undefined {
    // TODO we also use this for the PeerToPeerTransport, maybe receive this as part of the config
    if (lastPlayerPositionReport) {
      const { x, y, z } = lastPlayerPositionReport.position
      return [x, y, z]
    }
  }
}
