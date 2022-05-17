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
  TopicIdentityFWMessage
} from './proto/broker'
import { Position, positionHash } from '../../comms/interface/utils'
import { IBrokerTransport, TransportMessage } from './IBrokerTransport'
import { Stats } from '../../comms/debug'
import { createLogger } from 'shared/logger'

import { CommsEvents, RoomConnection } from '../../comms/interface/index'
import { ProfileType } from 'shared/profiles/types'
import { EncodedFrame } from 'voice-chat-codec/types'
import mitt from 'mitt'
import { Avatar } from '@dcl/schemas'
import { validateAvatar } from '../../profiles/schemaValidation'
import { commsLogger } from '../context'

class SendResult {
  constructor(public bytesSize: number) {}
}

export class BrokerWorldInstanceConnection implements RoomConnection {
  aliases: Record<number, string> = {}

  events = mitt<CommsEvents>()

  _stats: Stats | null = null

  private pingInterval: any = null

  private logger = createLogger('World: ')

  constructor(private broker: IBrokerTransport) {
    this.pingInterval = setInterval(() => {
      const msg = new PingMessage()
      msg.setType(MessageType.PING)
      msg.setTime(Date.now())
      const bytes = msg.serializeBinary()

      this.broker.send(bytes, false)
    }, 10000)
    this.broker.onMessageObservable.add(this.handleMessage.bind(this))
    this.broker.onDisconnectObservable.add(this.disconnect.bind(this))
  }

  async connect(): Promise<void> {
    await this.broker.connect()
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

    const r = this.sendTopicMessage(false, topic, d)
    if (this._stats) {
      this._stats.position.incrementSent(1, r.bytesSize)
    }
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

    const r = this.sendTopicMessage(false, topic, d)
    if (this._stats) {
      this._stats.position.incrementSent(1, r.bytesSize)
    }
  }

  async sendProfileMessage(currentPosition: Position, address: string, profileType: ProfileType, version: number) {
    const topic = positionHash(currentPosition)

    const d = new ProfileData()
    d.setCategory(Category.PROFILE)
    d.setTime(Date.now())
    d.setProfileType(profileType)
    d.setProfileVersion('' + version)

    const r = this.sendTopicIdentityMessage(true, topic, d)
    if (this._stats) {
      this._stats.profile.incrementSent(1, r.bytesSize)
    }
  }

  async sendProfileRequest(position: Position, userId: string, version: number | undefined) {
    const topic = positionHash(position)

    const d = new ProfileRequestData()
    d.setCategory(Category.PROF_REQ)
    d.setTime(Date.now())
    d.setUserId(userId)
    version && d.setProfileVersion('' + version)

    const r = this.sendTopicIdentityMessage(true, topic, d)
    if (this._stats) {
      this._stats.profile.incrementSent(1, r.bytesSize)
    }
  }

  async sendProfileResponse(currentPosition: Position, profile: Avatar) {
    const topic = positionHash(currentPosition)

    const d = new ProfileResponseData()
    d.setCategory(Category.PROF_RES)
    d.setTime(Date.now())
    d.setSerializedProfile(JSON.stringify(profile))

    const r = this.sendTopicIdentityMessage(true, topic, d)
    if (this._stats) {
      this._stats.profile.incrementSent(1, r.bytesSize)
    }
  }
  async sendInitialMessage(address: string) {
    const d = new ProfileData()
    d.setCategory(Category.PROFILE)
    d.setTime(Date.now())
    d.setProfileVersion('')

    const r = this.sendTopicIdentityMessage(true, address, d)
    if (this._stats) {
      this._stats.profile.incrementSent(1, r.bytesSize)
    }
  }

  async sendParcelSceneCommsMessage(sceneId: string, message: string) {
    const topic = sceneId

    // TODO: create its own class once we get the .proto file
    const d = new ChatData()
    d.setCategory(Category.SCENE_MESSAGE)
    d.setTime(Date.now())
    d.setMessageId(sceneId)
    d.setText(message)

    const r = this.sendTopicMessage(true, topic, d)

    if (this._stats) {
      this._stats.sceneComms.incrementSent(1, r.bytesSize)
    }
  }

  async sendChatMessage(p: Position, messageId: string, text: string) {
    const topic = positionHash(p)

    const d = new ChatData()
    d.setCategory(Category.CHAT)
    d.setTime(Date.now())
    d.setMessageId(messageId)
    d.setText(text)

    const r = this.sendTopicMessage(true, topic, d)

    if (this._stats) {
      this._stats.chat.incrementSent(1, r.bytesSize)
    }
  }

  sendTopicMessage(reliable: boolean, topic: string, body: Message): SendResult {
    const encodedBody = body.serializeBinary()

    const message = new TopicMessage()
    message.setType(MessageType.TOPIC)
    message.setTopic(topic)
    message.setBody(encodedBody)

    return this.sendMessage(reliable, message)
  }

  sendTopicIdentityMessage(reliable: boolean, topic: string, body: Message): SendResult {
    const encodedBody = body.serializeBinary()

    const message = new TopicIdentityMessage()
    message.setType(MessageType.TOPIC_IDENTITY)
    message.setTopic(topic)
    message.setBody(encodedBody)

    return this.sendMessage(reliable, message)
  }

  async setTopics(rawTopics: string[]) {
    const subscriptionMessage = new SubscriptionMessage()
    subscriptionMessage.setType(MessageType.SUBSCRIPTION)
    subscriptionMessage.setFormat(Format.PLAIN)
    // TODO: use TextDecoder instead of Buffer, it is a native browser API, works faster
    subscriptionMessage.setTopics(Buffer.from(rawTopics.join(' '), 'utf8'))
    const bytes = subscriptionMessage.serializeBinary()
    this.broker.send(bytes, true)
  }

  async disconnect() {
    if (this.pingInterval) {
      this.events.emit('DISCONNECTION')
      clearInterval(this.pingInterval)
    }
    await this.broker.disconnect()
  }

  async sendVoiceMessage(_currentPosition: Position, frame: EncodedFrame): Promise<void> {
    this.events.emit('voiceMessage', {
      sender: '0x123',
      time: new Date().getTime(),
      data: frame
    })
  }

  private handleMessage(message: TransportMessage) {
    const msgSize = message.data.length

    let msgType = MessageType.UNKNOWN_MESSAGE_TYPE
    try {
      msgType = MessageHeader.deserializeBinary(message.data).getType()
    } catch (err) {
      this.logger.error('cannot deserialize worldcomm message header ' + message.channel + ' ' + msgSize)
      return
    }

    switch (msgType) {
      case MessageType.UNKNOWN_MESSAGE_TYPE: {
        if (this._stats) {
          this._stats.others.incrementRecv(msgSize)
        }
        this.logger.log('unsupported message')
        break
      }
      case MessageType.TOPIC_FW: {
        if (this._stats) {
          this._stats.topic.incrementRecv(msgSize)
        }
        let dataMessage: TopicFWMessage
        try {
          dataMessage = TopicFWMessage.deserializeBinary(message.data)
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

            if (this._stats) {
              this._stats.dispatchTopicDuration.stop()
              this._stats.position.incrementRecv(msgSize)
              this._stats.onPositionMessage(alias, positionData)
            }

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

            if (this._stats) {
              this._stats.dispatchTopicDuration.stop()
              this._stats.chat.incrementRecv(msgSize)
            }

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

            if (this._stats) {
              this._stats.dispatchTopicDuration.stop()
              this._stats.sceneComms.incrementRecv(msgSize)
            }

            this.events.emit('sceneMessageBus', {
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
        if (this._stats) {
          this._stats.topic.incrementRecv(msgSize)
        }
        let dataMessage: TopicIdentityFWMessage
        try {
          dataMessage = TopicIdentityFWMessage.deserializeBinary(message.data)
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
            if (this._stats) {
              this._stats.dispatchTopicDuration.stop()
              this._stats.profile.incrementRecv(msgSize)
            }
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
            const profile = JSON.parse(profileResponseData.getSerializedProfile()) as Avatar
            if (validateAvatar(profile)) {
              this.events.emit('profileResponse', {
                sender: alias,
                time: profileResponseData.getTime(),
                data: {
                  profile
                }
              })
            } else {
              commsLogger.error('Received invalid Avatar schema over comms', profile, validateAvatar.errors)
            }
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
        if (this._stats) {
          this._stats.others.incrementRecv(msgSize)
        }
        this.logger.log('ignoring message with type', msgType)
        break
      }
    }
  }

  private sendMessage(reliable: boolean, topicMessage: Message) {
    const bytes = topicMessage.serializeBinary()
    if (this._stats) {
      this._stats.topic.incrementSent(1, bytes.length)
    }
    this.broker.send(bytes, reliable)
    return new SendResult(bytes.length)
  }
}
