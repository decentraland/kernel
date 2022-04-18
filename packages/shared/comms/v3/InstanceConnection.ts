/// <reference lib="dom" />

import {
  ProfileResponseData,
  ProfileRequestData,
  Category,
  ChatData,
  PositionData,
  ProfileData,
  DataHeader,
  WorldPositionData
} from './proto/comms_pb'
import { Position } from '../../comms/interface/utils'
import { UserInformation } from '../../comms/interface/types'
import { BFFConnection } from './BFFConnection'
import { Transport, TransportMessage } from './Transport'
import { createLogger } from 'shared/logger'

import { CommsEvents, RoomConnection } from '../../comms/interface/index'
import { getProfileType } from 'shared/profiles/getProfileType'
import { Profile } from 'shared/types'
import { ProfileType } from 'shared/profiles/types'
import { EncodedFrame } from 'voice-chat-codec/types'
import mitt from 'mitt'
import { HeartBeatMessage, MessageType } from './proto/bff_pb'

export class InstanceConnection implements RoomConnection {
  events = mitt<CommsEvents>()

  private logger = createLogger('Commsv3 connection: ')

  constructor(private bff: BFFConnection, private transport: Transport) {
    this.bff.onTopicMessageObservable.add(this.handleTopicMessage.bind(this))
    this.bff.onDisconnectObservable.add(this.disconnect.bind(this))

    this.transport.onMessageObservable.add(this.handleTransportMessage.bind(this))
    this.transport.onDisconnectObservable.add(this.disconnect.bind(this))
  }

  async connect(): Promise<boolean> {
    await Promise.all([this.bff.connect(), this.transport.connect()])
    return true
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

  async sendParcelUpdateMessage(_: Position, newPosition: Position) {
    const msg = new HeartBeatMessage()
    msg.setType(MessageType.HEARTBEAT)
    msg.setTime(Date.now())

    const data = new WorldPositionData()
    data.setCategory(Category.WORLD_POSITION)
    data.setTime(Date.now())

    data.setPositionX(newPosition[0])
    data.setPositionY(newPosition[1])
    data.setPositionZ(newPosition[2])

    msg.setData(data.serializeBinary())

    this.bff.send(msg.serializeBinary())
  }

  async sendProfileMessage(_: Position, userProfile: UserInformation) {
    const d = new ProfileData()
    d.setCategory(Category.PROFILE)
    d.setTime(Date.now())
    d.setProfileType(getProfileType(userProfile.identity))
    userProfile.version && d.setProfileVersion('' + userProfile.version)

    this.transport.sendIdentity(d, true)
  }

  async sendProfileRequest(_: Position, userId: string, version: number | undefined) {
    const d = new ProfileRequestData()
    d.setCategory(Category.PROF_REQ)
    d.setTime(Date.now())
    d.setUserId(userId)
    version && d.setProfileVersion('' + version)

    this.transport.sendIdentity(d, true)
  }

  async sendProfileResponse(_: Position, profile: Profile) {
    const d = new ProfileResponseData()
    d.setCategory(Category.PROF_RES)
    d.setTime(Date.now())
    d.setSerializedProfile(JSON.stringify(profile))

    this.transport.sendIdentity(d, true)
  }

  async sendInitialMessage(userProfile: UserInformation) {
    const d = new ProfileData()
    d.setCategory(Category.PROFILE)
    d.setTime(Date.now())
    userProfile.version && d.setProfileVersion('' + userProfile.version)

    this.transport.sendIdentity(d, true)
  }

  async sendParcelSceneCommsMessage(sceneId: string, message: string) {
    const d = new ChatData()
    d.setCategory(Category.SCENE_MESSAGE)
    d.setTime(Date.now())
    d.setMessageId(sceneId)
    d.setText(message)

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

  async setTopics(rawTopics: string[]) {
    this.bff.setTopics(rawTopics)
  }

  async disconnect(): Promise<void> {
    await Promise.all([this.transport.disconnect(), this.bff.disconnect()])
  }

  async sendVoiceMessage(_currentPosition: Position, frame: EncodedFrame): Promise<void> {
    this.events.emit('voiceMessage', {
      sender: '0x123',
      time: new Date().getTime(),
      data: frame
    })
  }

  private handleTopicMessage(data: Uint8Array) {
    let dataHeader: DataHeader
    try {
      dataHeader = DataHeader.deserializeBinary(data)
    } catch (e) {
      this.logger.error('cannot topic message, data header', e)
      return
    }

    const category = dataHeader.getCategory()
    switch (category) {
      case Category.SCENE_MESSAGE: {
        //TODO
        // const chatData = ChatData.deserializeBinary(data)
        // this.events.emit('chatMessage', {
        //   sender: alias,
        //   time: chatData.getTime(),
        //   data: { id: chatData.getMessageId(), text: chatData.getText() }
        // })
        break
      }
      default: {
        this.logger.log('ignoring category', category)
        break
      }
    }
  }

  private handleTransportMessage({ peer, data }: TransportMessage) {
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
            profile: JSON.parse(profileResponseData.getSerializedProfile()) as Profile
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
}
