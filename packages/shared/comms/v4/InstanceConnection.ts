/// <reference lib="dom" />

import {
  ProfileResponseData,
  ProfileRequestData,
  Category,
  ChatData,
  PositionData,
  ProfileData,
  DataHeader,
  SceneData,
  VoiceData
} from './proto/comms_pb'
import { Position } from '../../comms/interface/utils'
import { BFFConnection, TopicData } from './BFFConnection'
import { WsTransport } from './WsTransport'
import { LivekitTransport } from './LivekitTransport'
import { Transport, TransportMessage } from './Transport'
import { createLogger } from 'shared/logger'

import { PeerToPeerTransport } from './PeerToPeerTransport'
import { CommsEvents, RoomConnection } from '../../comms/interface/index'
import { ProfileType } from 'shared/profiles/types'
import { EncodedFrame } from 'voice-chat-codec/types'
import mitt from 'mitt'
import { DummyTransport } from './DummyTransport'
import { Avatar } from '@dcl/schemas'


export class InstanceConnection implements RoomConnection {
  events = mitt<CommsEvents>()

  private logger = createLogger('CommsV4: ')
  private transport: Transport = new DummyTransport()

  constructor(private bff: BFFConnection) {
    this.bff.onTopicMessageObservable.add(this.handleTopicMessage.bind(this))
    this.bff.onDisconnectObservable.add(this.disconnect.bind(this))
  }

  async connect(): Promise<void> {
    this.bff.onIslandChangeObservable.add(async (islandConnStr) => {
      this.logger.info(`Got island change message: ${islandConnStr}`)
      const transport = this.createTransport(islandConnStr)
      if (!transport) {
        this.logger.error(`Invalid islandConnStr ${islandConnStr}`)
        return
      }
      this.changeTransport(transport)
    })
    await this.bff.connect()
  }

  async sendPositionMessage(p: Position) {
    const d = new PositionData()
    d.setCategory(Category.POSITION)
    d.setTime(Date.now())
    d.setPositionX(p[0])
    d.setPositionY(p[1])
    d.setPositionZ(p[2])
    d.setRotationX(p[3])
    d.setRotationY(p[4])
    d.setRotationZ(p[5])
    d.setRotationW(p[6])

    this.transport.send(d, false)
  }

  async sendParcelUpdateMessage(_: Position, _newPosition: Position) {
  }

  async sendProfileMessage(_: Position, __: string, profileType: ProfileType, version: number) {
    const d = new ProfileData()
    d.setCategory(Category.PROFILE)
    d.setTime(Date.now())
    d.setProfileType(profileType)
    d.setProfileVersion(`${version}`)

    this.transport.sendIdentity(d, true)
  }

  async sendProfileRequest(_: Position, userId: string, version: number | undefined) {
    const d = new ProfileRequestData()
    d.setCategory(Category.PROF_REQ)
    d.setTime(Date.now())
    d.setUserId(userId)
    d.setProfileVersion(`${version}`)

    this.transport.sendIdentity(d, true)
  }

  async sendProfileResponse(_: Position, profile: Avatar) {
    const d = new ProfileResponseData()
    d.setCategory(Category.PROF_RES)
    d.setTime(Date.now())
    d.setSerializedProfile(JSON.stringify(profile))

    this.transport.sendIdentity(d, true)
  }

  async sendInitialMessage(_: string, profileType: ProfileType) {
    const d = new ProfileData()
    d.setCategory(Category.PROFILE)
    d.setTime(Date.now())
    d.setProfileType(profileType)
    d.setProfileVersion('')

    this.transport.sendIdentity(d, true)
  }

  async sendParcelSceneCommsMessage(sceneId: string, message: string) {
    const d = new SceneData()
    d.setCategory(Category.SCENE_MESSAGE)
    d.setTime(Date.now())
    d.setSceneId(sceneId)
    d.setData(message)

    this.bff.sendTopicMessage(sceneId, d)
  }

  async sendChatMessage(_: Position, messageId: string, text: string) {
    const d = new ChatData()
    d.setCategory(Category.CHAT)
    d.setTime(Date.now())
    d.setMessageId(messageId)
    d.setText(text)
    this.transport.send(d, true)
  }

  async setTopics(topics: string[]) {
    this.bff.setTopics(topics)
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect()
    }
    return this.bff.disconnect()
  }

  async sendVoiceMessage(_: Position, frame: EncodedFrame): Promise<void> {
    const d = new VoiceData()
    d.setCategory(Category.VOICE)
    d.setEncodedSamples(frame.encoded)
    d.setIndex(frame.index)

    return this.transport.send(d, true)
  }

  protected handleTopicMessage(message: TopicData) {
    let dataHeader: DataHeader
    try {
      dataHeader = DataHeader.deserializeBinary(message.data)
    } catch (e) {
      this.logger.error('cannot process topic message, data header', e)
      return
    }

    const category = dataHeader.getCategory()
    switch (category) {
      case Category.SCENE_MESSAGE: {
        const sceneData = SceneData.deserializeBinary(message.data)

        this.events.emit('sceneMessageBus', {
          sender: message.peerId,
          time: sceneData.getTime(),
          data: {
            id: sceneData.getSceneId(),
            text: sceneData.getData() as string
          }
        })
        break
      }
      default: {
        this.logger.log('ignoring category', category)
        break
      }
    }
  }

  protected handleTransportMessage({ peer, data }: TransportMessage) {
    let dataHeader: DataHeader
    try {
      dataHeader = DataHeader.deserializeBinary(data)
    } catch (e) {
      this.logger.error('cannot process data header', e)
      return
    }

    const category = dataHeader.getCategory()

    switch (category) {
      case Category.POSITION: {

        // TODO
        // this.peer.setPeerPosition(sender, positionMessage.slice(0, 3) as [number, number, number])
        const positionData = PositionData.deserializeBinary(data)
        this.events.emit('position', {
          sender: peer,
          time: positionData.getTime(),
          data: [
            positionData.getPositionX(),
            positionData.getPositionY(),
            positionData.getPositionZ(),
            positionData.getRotationX(),
            positionData.getRotationY(),
            positionData.getRotationZ(),
            positionData.getRotationW(),
            false
          ]
        })
        break
      }
      case Category.CHAT: {
        const chatData = ChatData.deserializeBinary(data)

        this.events.emit('chatMessage', {
          sender: peer,
          time: chatData.getTime(),
          data: {
            id: chatData.getMessageId(),
            text: chatData.getText()
          }
        })
        break
      }
      case Category.VOICE: {
        const voiceData = VoiceData.deserializeBinary(data)

        this.events.emit('voiceMessage', {
          sender: peer,
          time: new Date().getTime(),
          data: {
            encoded: voiceData.getEncodedSamples_asU8(),
            index: voiceData.getIndex()
          }
        })
        break
      }
      case Category.PROFILE: {
        const profileData = ProfileData.deserializeBinary(data)
        this.events.emit('profileMessage', {
          sender: peer,
          time: profileData.getTime(),
          data: {
            user: peer,
            version: profileData.getProfileVersion(),
            type:
              profileData.getProfileType() === ProfileData.ProfileType.LOCAL ? ProfileType.LOCAL : ProfileType.DEPLOYED
          } // We use deployed as default because that way we can emulate the old behaviour
        })
        break
      }
      case Category.PROF_REQ: {
        const profileRequestData = ProfileRequestData.deserializeBinary(data)
        this.events.emit('profileRequest', {
          sender: peer,
          time: profileRequestData.getTime(),
          data: {
            userId: profileRequestData.getUserId(),
            version: profileRequestData.getProfileVersion()
          }
        })
        break
      }
      case Category.PROF_RES: {
        const profileResponseData = ProfileResponseData.deserializeBinary(data)
        this.events.emit('profileResponse', {
          sender: peer,
          time: profileResponseData.getTime(),
          data: {
            profile: JSON.parse(profileResponseData.getSerializedProfile()) as Avatar
          }
        })
        break
      }
      default: {
        this.logger.log('ignoring category', category)
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

  private createTransport(islandConnStr: string): Transport | null {
    let transport: Transport | null = null
    if (islandConnStr.startsWith('ws-room:')) {
      transport = new WsTransport(islandConnStr.substring('ws-room:'.length))
    } else if (islandConnStr.startsWith('livekit:')) {
      transport = new LivekitTransport(islandConnStr.substring('livekit:'.length))
    } else if (islandConnStr.startsWith('lighthouse:')) {
      const lighthouseUrl = islandConnStr.substring('lighthouse:'.length)

      const url = new URL(lighthouseUrl)
      const islandId = url.searchParams.get('island_id')
      if (islandId) {
        this.logger.log('Using Remote lighthouse service: ', lighthouseUrl)
        transport = new PeerToPeerTransport(lighthouseUrl, islandId)
      } else {
        this.logger.error(`Lighthhouse connections string is missing island_id parameter ${lighthouseUrl}`)
      }
    }
    return transport
  }
}
