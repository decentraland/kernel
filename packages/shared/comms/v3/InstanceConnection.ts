/// <reference lib="dom" />

import { Message } from 'google-protobuf'
import {
  ProfileResponseData,
  ProfileRequestData,
  Category,
  ChatData,
  PositionData,
  ProfileData,
  DataHeader
} from './proto/comms_pb'
import {
  MessageType,
  PingMessage,
  TopicMessage,
  TopicFWMessage,
  Format,
  SubscriptionMessage,
  MessageHeader,
  TopicIdentityMessage,
  TopicIdentityFWMessage,
  MessageTypeMap
} from './proto/broker_pb'
import { Position, positionHash } from '../../comms/interface/utils'
import { UserInformation } from '../../comms/interface/types'
import { BFFConnection } from './BFFConnection'
import { Transport } from './Transport'
import { createLogger } from 'shared/logger'

import { CommsEvents, RoomConnection } from '../../comms/interface/index'
import { getProfileType } from 'shared/profiles/getProfileType'
import { Profile } from 'shared/types'
import { ProfileType } from 'shared/profiles/types'
import { EncodedFrame } from 'voice-chat-codec/types'
import mitt from 'mitt'

export class InstanceConnection implements RoomConnection {
  aliases: Record<number, string> = {}

  events = mitt<CommsEvents>()

  private pingInterval: any = null

  private logger = createLogger('Commsv3 connection: ')

  constructor(private bff: BFFConnection, private transport: Transport) {
    this.pingInterval = setInterval(() => {
      const msg = new PingMessage()
      msg.setType(MessageType.PING)
      msg.setTime(Date.now())
      const bytes = msg.serializeBinary()

      this.bff.send(bytes, false)
    }, 10000)
    this.bff.onMessageObservable.add(this.handleBFFMessage.bind(this))
    this.bff.onDisconnectObservable.add(this.disconnect.bind(this))
    this.transport.onMessageObservable.add(this.handleTransportMessage.bind(this))
    this.transport.onDisconnectObservable.add(this.disconnect.bind(this))
  }

  async connect(): Promise<boolean> {
    await this.bff.connect()
    return true
  }

  async sendPositionMessage(p: Position) {
    const topic = positionHash(p)

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

    this.sendTopicMessage(false, topic, d)
  }

  async sendParcelUpdateMessage(current: Position, newPosition: Position) {
    const topic = positionHash(current)

    const d = new PositionData()
    d.setCategory(Category.POSITION)
    d.setTime(Date.now())
    d.setPositionX(newPosition[0])
    d.setPositionY(newPosition[1])
    d.setPositionZ(newPosition[2])
    d.setRotationX(newPosition[3])
    d.setRotationY(newPosition[4])
    d.setRotationZ(newPosition[5])
    d.setRotationW(newPosition[6])
    // TODO ADD d.setImmediately(newPosition[7])

    this.sendTopicMessage(false, topic, d)
  }

  async sendProfileMessage(p: Position, userProfile: UserInformation) {
    const topic = positionHash(p)

    const d = new ProfileData()
    d.setCategory(Category.PROFILE)
    d.setTime(Date.now())
    d.setProfileType(getProfileType(userProfile.identity))
    userProfile.version && d.setProfileVersion('' + userProfile.version)

    this.sendTopicIdentityMessage(true, topic, d)
  }

  async sendProfileRequest(position: Position, userId: string, version: number | undefined) {
    const topic = positionHash(position)

    const d = new ProfileRequestData()
    d.setCategory(Category.PROF_REQ)
    d.setTime(Date.now())
    d.setUserId(userId)
    version && d.setProfileVersion('' + version)

    this.sendTopicIdentityMessage(true, topic, d)
  }

  async sendProfileResponse(currentPosition: Position, profile: Profile) {
    const topic = positionHash(currentPosition)

    const d = new ProfileResponseData()
    d.setCategory(Category.PROF_RES)
    d.setTime(Date.now())
    d.setSerializedProfile(JSON.stringify(profile))

    this.sendTopicIdentityMessage(true, topic, d)
  }

  async sendInitialMessage(userProfile: UserInformation) {
    const topic = userProfile.userId

    const d = new ProfileData()
    d.setCategory(Category.PROFILE)
    d.setTime(Date.now())
    userProfile.version && d.setProfileVersion('' + userProfile.version)

    this.sendTopicIdentityMessage(true, topic, d)
  }

  async sendParcelSceneCommsMessage(sceneId: string, message: string) {
    const topic = sceneId

    // TODO: create its own class once we get the .proto file
    const d = new ChatData()
    d.setCategory(Category.SCENE_MESSAGE)
    d.setTime(Date.now())
    d.setMessageId(sceneId)
    d.setText(message)

    this.sendTopicMessage(true, topic, d)
  }

  async sendChatMessage(p: Position, messageId: string, text: string) {
    const topic = positionHash(p)

    const d = new ChatData()
    d.setCategory(Category.CHAT)
    d.setTime(Date.now())
    d.setMessageId(messageId)
    d.setText(text)

    this.sendTopicMessage(true, topic, d)
  }

  sendTopicMessage(reliable: boolean, topic: string, body: Message) {
    const encodedBody = body.serializeBinary()

    const message = new TopicMessage()
    message.setType(MessageType.TOPIC)
    message.setTopic(topic)
    message.setBody(encodedBody)

    this.transport.send(message.serializeBinary(), reliable)
  }

  sendTopicIdentityMessage(reliable: boolean, topic: string, body: Message) {
    const encodedBody = body.serializeBinary()

    const message = new TopicIdentityMessage()
    message.setType(MessageType.TOPIC_IDENTITY)
    message.setTopic(topic)
    message.setBody(encodedBody)

    this.transport.send(message.serializeBinary(), reliable)
  }

  async setTopics(rawTopics: string[]) {
    const subscriptionMessage = new SubscriptionMessage()
    subscriptionMessage.setType(MessageType.SUBSCRIPTION)
    subscriptionMessage.setFormat(Format.PLAIN)
    // TODO: use TextDecoder instead of Buffer, it is a native browser API, works faster
    subscriptionMessage.setTopics(Buffer.from(rawTopics.join(' '), 'utf8'))
    const bytes = subscriptionMessage.serializeBinary()
    this.transport.send(bytes, true)
  }

  async disconnect(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }
    await Promise.all([
      this.transport.disconnect(),
      this.bff.disconnect()
    ])
  }

  async sendVoiceMessage(_currentPosition: Position, frame: EncodedFrame): Promise<void> {
    this.events.emit('voiceMessage', {
      sender: '0x123',
      time: new Date().getTime(),
      data: frame
    })
  }

  private handleBFFMessage(message: Uint8Array) {
    // TODO
  }

  private handleTransportMessage(data: Uint8Array) {
    let msgType = MessageType.UNKNOWN_MESSAGE_TYPE as MessageTypeMap[keyof MessageTypeMap]
    try {
      msgType = MessageHeader.deserializeBinary(data).getType()
    } catch (err) {
      this.logger.error('cannot deserialize message header')
      return
    }

    switch (msgType) {
      case MessageType.UNKNOWN_MESSAGE_TYPE: {
        this.logger.log('unsupported message')
        break
      }
      case MessageType.TOPIC_FW: {
        let dataMessage: TopicFWMessage
        try {
          dataMessage = TopicFWMessage.deserializeBinary(data)
        } catch (e) {
          this.logger.error('cannot process topic message', e)
          break
        }

        const body = dataMessage.getBody() as any

        let dataHeader: DataHeader
        try {
          dataHeader = DataHeader.deserializeBinary(body)
        } catch (e) {
          this.logger.error('cannot process data header', e)
          break
        }

        const aliasNum = dataMessage.getFromAlias()
        const alias = aliasNum.toString()
        const category = dataHeader.getCategory()

        switch (category) {
          case Category.POSITION: {
            const positionData = PositionData.deserializeBinary(body)
            this.events.emit('position', {
              sender: alias,
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
            const chatData = ChatData.deserializeBinary(body)

            this.events.emit('chatMessage', {
              sender: alias,
              time: chatData.getTime(),
              data: {
                id: chatData.getMessageId(),
                text: chatData.getText()
              }
            })
            break
          }
          case Category.SCENE_MESSAGE: {
            const chatData = ChatData.deserializeBinary(body)

            this.events.emit('chatMessage', {
              sender: alias,
              time: chatData.getTime(),
              data: { id: chatData.getMessageId(), text: chatData.getText() }
            })
            break
          }
          default: {
            this.logger.log('ignoring category', category)
            break
          }
        }
        break
      }
      case MessageType.TOPIC_IDENTITY_FW: {
        let dataMessage: TopicIdentityFWMessage
        try {
          dataMessage = TopicIdentityFWMessage.deserializeBinary(data)
        } catch (e) {
          this.logger.error('cannot process topic identity message', e)
          break
        }

        const body = dataMessage.getBody() as any

        let dataHeader: DataHeader
        try {
          dataHeader = DataHeader.deserializeBinary(body)
        } catch (e) {
          this.logger.error('cannot process data header', e)
          break
        }

        const alias = dataMessage.getFromAlias().toString()
        const userId = atob(dataMessage.getIdentity_asB64())
        this.aliases[dataMessage.getFromAlias()] = userId
        const category = dataHeader.getCategory()
        switch (category) {
          case Category.PROFILE: {
            const profileData = ProfileData.deserializeBinary(body)
            this.events.emit('profileMessage', {
              sender: alias,
              time: profileData.getTime(),
              data: {
                user: userId,
                version: profileData.getProfileVersion(),
                type:
                  profileData.getProfileType() === ProfileData.ProfileType.LOCAL
                    ? ProfileType.LOCAL
                    : ProfileType.DEPLOYED
              } // We use deployed as default because that way we can emulate the old behaviour
            })
            break
          }
          case Category.PROF_REQ: {
            const profileRequestData = ProfileRequestData.deserializeBinary(body)
            this.events.emit('profileRequest', {
              sender: alias,
              time: profileRequestData.getTime(),
              data: {
                userId: profileRequestData.getUserId(),
                version: profileRequestData.getProfileVersion()
              }
            })
            break
          }
          case Category.PROF_RES: {
            const profileResponseData = ProfileResponseData.deserializeBinary(body)
            this.events.emit('profileResponse', {
              sender: alias,
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
        break
      }
      case MessageType.PING: {
        break
      }
      default: {
        this.logger.log('ignoring message with type', msgType)
        break
      }
    }
  }
}
