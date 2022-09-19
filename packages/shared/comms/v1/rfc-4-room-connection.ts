import * as proto from '../comms-rfc-4.gen'
import { IBrokerTransport, TransportMessage } from './IBrokerTransport'

import { CommsEvents, RoomConnection } from '../interface/index'
import mitt from 'mitt'

export class Rfc4RoomConnection implements RoomConnection {
  events = mitt<CommsEvents>()

  private positionIndex: number = 0

  constructor(private broker: IBrokerTransport) {
    this.broker.onMessageObservable.add(this.handleMessage.bind(this))
    this.broker.onDisconnectObservable.add(() => this.events.emit('DISCONNECTION'))
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
    await this.broker.disconnect()
  }

  private handleMessage(message: TransportMessage) {
    const packet = proto.Packet.decode(message.data)

    if (packet.position)
      this.events.emit('position', { address: message.senderAddress, data: packet.position, time: Date.now() })
    else if (packet.scene)
      this.events.emit('sceneMessageBus', { address: message.senderAddress, data: packet.scene, time: Date.now() })
    else if (packet.chat)
      this.events.emit('chatMessage', { address: message.senderAddress, data: packet.chat, time: Date.now() })
    else if (packet.voice)
      this.events.emit('voiceMessage', { address: message.senderAddress, data: packet.voice, time: Date.now() })
    else if (packet.profileRequest)
      this.events.emit('profileRequest', {
        address: message.senderAddress,
        data: packet.profileRequest,
        time: Date.now()
      })
    else if (packet.profileResponse)
      this.events.emit('profileResponse', {
        address: message.senderAddress,
        data: packet.profileResponse,
        time: Date.now()
      })
    else if (packet.profileVersion)
      this.events.emit('profileMessage', {
        address: message.senderAddress,
        data: packet.profileVersion,
        time: Date.now()
      })
  }

  private async sendMessage(reliable: boolean, topicMessage: Partial<proto.Packet>) {
    if (Object.keys(topicMessage).length == 0) throw new Error('Invalid message')
    const bytes = proto.Packet.encode(topicMessage as any).finish()
    this.broker.send(bytes, reliable)
  }
}
