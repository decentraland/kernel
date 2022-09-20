import * as proto from 'shared/protocol/kernel/comms/comms-rfc-4.gen'
import { ICommsTransport, TransportMessage, CommsEvents, RoomConnection } from '../interface'
import mitt from 'mitt'

/**
 * This class implements Rfc4 on top of a ICommsTransport. The idea behind it is
 * to serve as a reference implementation for comss. ICommsTransport can be an IRC
 * server, an echo server, a mocked implementation or WebSocket among many others.
 */
export class Rfc4RoomConnection implements RoomConnection {
  events = mitt<CommsEvents>()

  private positionIndex: number = 0

  constructor(private transport: ICommsTransport) {
    this.transport.events.on('message', this.handleMessage.bind(this))
    this.transport.events.on('DISCONNECTION', (event) => this.events.emit('DISCONNECTION', event))
    this.transport.events.on('PEER_DISCONNECTED', (event) => this.events.emit('PEER_DISCONNECTED', event))
  }

  async connect(): Promise<void> {
    await this.transport.connect()
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
    await this.transport.disconnect()
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
    if (Object.keys(topicMessage).length === 0) throw new Error('Invalid message')
    const bytes = proto.Packet.encode(topicMessage as any).finish()
    this.transport.send(bytes, reliable)
  }
}
