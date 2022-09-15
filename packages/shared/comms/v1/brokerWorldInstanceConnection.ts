import { Message } from 'google-protobuf'
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
import * as proto from '../comms-rfc-4.gen'
import { positionHash } from '../../comms/interface/utils'
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
  events = mitt<CommsEvents>()

  private aliases = new Map<string, { address: string }>()
  private pingInterval: any = null
  private positionIndex: number = 0

  private logger = createLogger('BrokerWorldInstanceConnection: ')

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

  sendPositionMessage(p: proto.Position): Promise<void> {
    return this.sendMessage(false, {
      position: {
        ...p,
        index: this.positionIndex++
      }
    })
  }

  sendParcelSceneMessage(scene: proto.Scene): Promise<void> {
    return this.sendMessage(false, { scene })
  }
  sendProfileMessage(profileVersion: proto.AnnounceProfileVersion): Promise<void> {
    return this.sendMessage(true, { profileVersion })
  }

  sendProfileRequest(profileRequest: proto.ProfileRequest): Promise<void> {
    return this.sendMessage(true, { profileRequest })
  }

  sendProfileResponse(profileResponse: proto.ProfileResponse): Promise<void> {
    return this.sendMessage(true, { profileResponse })
  }

  sendChatMessage(chat: proto.Chat): Promise<void> {
    return this.sendMessage(true, { chat })
  }

  sendVoiceMessage(voice: proto.Voice): Promise<void> {
    return this.sendMessage(true, { voice })
  }

  async disconnect() {
    if (this.pingInterval) {
      this.events.emit('DISCONNECTION')
      clearInterval(this.pingInterval)
      this.pingInterval = 0
    }
    await this.broker.disconnect()
  }

  private handleMessage(message: TransportMessage) {
    // const msgSize = message.data.length

    // let msgType = MessageType.UNKNOWN_MESSAGE_TYPE
    // try {
    //   msgType = MessageHeader.deserializeBinary(message.data).getType()
    // } catch (err) {
    //   this.logger.error('cannot deserialize worldcomm message header ' + message.channel + ' ' + msgSize)
    //   return
    // }

    // switch (msgType) {
    //   case MessageType.UNKNOWN_MESSAGE_TYPE: {
    //     if (this._stats) {
    //       this._stats.others.incrementRecv(msgSize)
    //     }
    //     this.logger.log('unsupported message')
    //     break
    //   }
    //   case MessageType.TOPIC_FW: {
    //     if (this._stats) {
    //       this._stats.topic.incrementRecv(msgSize)
    //     }
    //     let dataMessage: TopicFWMessage
    //     try {
    //       dataMessage = TopicFWMessage.deserializeBinary(message.data)
    //     } catch (e) {
    //       this.logger.error('cannot process topic message', e)
    //       break
    //     }

    //     const body = dataMessage.getBody() as any

    //     let dataHeader: DataHeader
    //     try {
    //       dataHeader = DataHeader.deserializeBinary(body)
    //     } catch (e) {
    //       this.logger.error('cannot process data header', e)
    //       break
    //     }

    //     const aliasNum = dataMessage.getFromAlias()
    //     const alias = aliasNum.toString()
    //     const category = dataHeader.getCategory()

    //     switch (category) {
    //       case Category.POSITION: {
    //         const positionData = PositionData.deserializeBinary(body)

    //         if (this._stats) {
    //           this._stats.dispatchTopicDuration.stop()
    //           this._stats.position.incrementRecv(msgSize)
    //           this._stats.onPositionMessage(alias)
    //         }

    //         this.events.emit('position', {
    //           sender: alias,
    //           time: positionData.getTime(),
    //           data: [
    //             positionData.getPositionX(),
    //             positionData.getPositionY(),
    //             positionData.getPositionZ(),
    //             positionData.getRotationX(),
    //             positionData.getRotationY(),
    //             positionData.getRotationZ(),
    //             positionData.getRotationW(),
    //             false
    //           ]
    //         })
    //         break
    //       }
    //       case Category.CHAT: {
    //         const chatData = ChatData.deserializeBinary(body)

    //         if (this._stats) {
    //           this._stats.dispatchTopicDuration.stop()
    //           this._stats.chat.incrementRecv(msgSize)
    //         }

    //         this.events.emit('chatMessage', {
    //           sender: alias,
    //           time: chatData.getTime(),
    //           data: {
    //             id: chatData.getMessageId(),
    //             text: chatData.getText()
    //           }
    //         })
    //         break
    //       }
    //       case Category.SCENE_MESSAGE: {
    //         const chatData = ChatData.deserializeBinary(body)

    //         if (this._stats) {
    //           this._stats.dispatchTopicDuration.stop()
    //           this._stats.sceneComms.incrementRecv(msgSize)
    //         }

    //         this.events.emit('sceneMessageBus', {
    //           sender: alias,
    //           time: chatData.getTime(),
    //           data: { id: chatData.getMessageId(), text: chatData.getText() }
    //         })
    //         break
    //       }
    //       default: {
    //         this.logger.log('ignoring category', category)
    //         break
    //       }
    //     }
    //     break
    //   }
    //   case MessageType.TOPIC_IDENTITY_FW: {
    //     if (this._stats) {
    //       this._stats.topic.incrementRecv(msgSize)
    //     }
    //     let dataMessage: TopicIdentityFWMessage
    //     try {
    //       dataMessage = TopicIdentityFWMessage.deserializeBinary(message.data)
    //     } catch (e) {
    //       this.logger.error('cannot process topic identity message', e)
    //       break
    //     }

    //     const body = dataMessage.getBody() as any

    //     let dataHeader: DataHeader
    //     try {
    //       dataHeader = DataHeader.deserializeBinary(body)
    //     } catch (e) {
    //       this.logger.error('cannot process data header', e)
    //       break
    //     }

    //     const alias = dataMessage.getFromAlias().toString()
    //     const userId = atob(dataMessage.getIdentity_asB64())
    //     this.aliases[dataMessage.getFromAlias()] = userId
    //     const category = dataHeader.getCategory()
    //     switch (category) {
    //       case Category.PROFILE: {
    //         const profileData = ProfileData.deserializeBinary(body)
    //         if (this._stats) {
    //           this._stats.dispatchTopicDuration.stop()
    //           this._stats.profile.incrementRecv(msgSize)
    //         }
    //         this.events.emit('profileMessage', {
    //           sender: alias,
    //           time: profileData.getTime(),
    //           data: {
    //             user: userId,
    //             version: profileData.getProfileVersion(),
    //             type:
    //               profileData.getProfileType() === ProfileData.ProfileType.LOCAL
    //                 ? ProfileType.LOCAL
    //                 : ProfileType.DEPLOYED
    //           } // We use deployed as default because that way we can emulate the old behaviour
    //         })
    //         break
    //       }
    //       case Category.PROF_REQ: {
    //         const profileRequestData = ProfileRequestData.deserializeBinary(body)
    //         this.events.emit('profileRequest', {
    //           sender: alias,
    //           time: profileRequestData.getTime(),
    //           data: {
    //             userId: profileRequestData.getUserId(),
    //             version: profileRequestData.getProfileVersion()
    //           }
    //         })
    //         break
    //       }
    //       case Category.PROF_RES: {
    //         const profileResponseData = ProfileResponseData.deserializeBinary(body)
    //         const profile = JSON.parse(profileResponseData.getSerializedProfile()) as Avatar
    //         if (validateAvatar(profile)) {
    //           this.events.emit('profileResponse', {
    //             sender: alias,
    //             time: profileResponseData.getTime(),
    //             data: {
    //               profile
    //             }
    //           })
    //         } else {
    //           commsLogger.error('Received invalid Avatar schema over comms', profile, validateAvatar.errors)
    //         }
    //         break
    //       }
    //       default: {
    //         this.logger.log('ignoring category', category)
    //         break
    //       }
    //     }
    //     break
    //   }
    //   case MessageType.PING: {
    //     break
    //   }
    //   default: {
    //     if (this._stats) {
    //       this._stats.others.incrementRecv(msgSize)
    //     }
    //     this.logger.log('ignoring message with type', msgType)
    //     break
    //   }
    // }
  }

  private async sendMessage(reliable: boolean, topicMessage: Partial<proto.Packet>) {
    if (Object.keys(topicMessage).length == 0) throw new Error('Invalid message')
    const bytes = proto.Packet.encode(topicMessage as any).finish()
    this.broker.send(bytes, reliable)
  }
}
