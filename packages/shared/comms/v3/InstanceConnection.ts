/// <reference lib="dom" />
import { store } from 'shared/store/isolatedStore'
import { getCommsConfig } from 'shared/meta/selectors'
import { Position3D } from './types'
import { Data, Profile_ProfileType } from './proto/comms.gen'
import { Position } from '../../comms/interface/utils'
import { BFFConnection, TopicData, TopicListener } from './BFFConnection'
import { TransportsConfig, Transport, DummyTransport, TransportMessage, createTransport } from '@dcl/comms3-transports'
import { createDummyLogger, createLogger } from 'shared/logger'
import { lastPlayerPositionReport, positionObservable } from 'shared/world/positionThings'

import { CommsEvents, RoomConnection } from '../../comms/interface/index'
import { ProfileType } from 'shared/profiles/types'
import { EncodedFrame } from 'voice-chat-codec/types'
import mitt from 'mitt'
import { Avatar } from '@dcl/schemas'
import { Reader } from 'protobufjs/minimal'
import { HeartbeatMessage, LeftIslandMessage, IslandChangedMessage } from './proto/archipelago.gen'
import { DEBUG, DEBUG_COMMS } from 'config'

export type Config = {
  onPeerLeft: (peerId: string) => void
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
    this.bff.onTopicMessageObservable.add(this.handleTopicMessage.bind(this))
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
