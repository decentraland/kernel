import * as proto from 'shared/protocol/kernel/comms/comms-rfc-4.gen'
import { CommsEvents, RoomConnection } from '../interface'
import mitt from 'mitt'
import { AdapterMessageEvent, MinimumCommunicationsAdapter } from '../adapters/types'

/**
 * This class implements Rfc4 on top of a ICommsTransport. The idea behind it is
 * to serve as a reference implementation for comss. ICommsTransport can be an IRC
 * server, an echo server, a mocked implementation or WebSocket among many others.
 */
export class Rfc4RoomConnection implements RoomConnection {
  events = mitt<CommsEvents>()

  private positionIndex: number = 0

  constructor(private transport: MinimumCommunicationsAdapter) {
    this.transport.events.on('message', this.handleMessage.bind(this))
    this.transport.events.on('DISCONNECTION', (event) => this.events.emit('DISCONNECTION', event))
    this.transport.events.on('PEER_DISCONNECTED', (event) => this.events.emit('PEER_DISCONNECTED', event))
  }

  async connect(): Promise<void> {
    await this.transport.connect()
  }

  sendPositionMessage(p: proto.Position): Promise<void> {
    return this.sendMessage(false, {
      message: {
        $case: 'position',
        position: {
          ...p,
          index: this.positionIndex++
        }
      }
    })
  }
  sendParcelSceneMessage(scene: proto.Scene): Promise<void> {
    return this.sendMessage(false, { message: { $case: 'scene', scene } })
  }
  sendProfileMessage(profileVersion: proto.AnnounceProfileVersion): Promise<void> {
    return this.sendMessage(true, { message: { $case: 'profileVersion', profileVersion } })
  }
  sendProfileRequest(profileRequest: proto.ProfileRequest): Promise<void> {
    return this.sendMessage(true, { message: { $case: 'profileRequest', profileRequest } })
  }
  sendProfileResponse(profileResponse: proto.ProfileResponse): Promise<void> {
    return this.sendMessage(true, { message: { $case: 'profileResponse', profileResponse } })
  }
  sendChatMessage(chat: proto.Chat): Promise<void> {
    return this.sendMessage(true, { message: { $case: 'chat', chat } })
  }
  sendVoiceMessage(voice: proto.Voice): Promise<void> {
    return this.sendMessage(true, { message: { $case: 'voice', voice } })
  }

  async disconnect() {
    await this.transport.disconnect()
  }

  private handleMessage({ data, address }: AdapterMessageEvent) {
    const { message } = proto.Packet.decode(data)

    if (!message) {
      return
    }

    switch (message.$case) {
      case 'position': {
        this.events.emit('position', { address, data: message.position, time: Date.now() })
        break
      }
      case 'scene': {
        this.events.emit('sceneMessageBus', { address, data: message.scene, time: Date.now() })
        break
      }
      case 'chat': {
        this.events.emit('chatMessage', { address, data: message.chat, time: Date.now() })
        break
      }
      case 'voice': {
        this.events.emit('voiceMessage', { address, data: message.voice, time: Date.now() })
        break
      }
      case 'profileRequest': {
        this.events.emit('profileRequest', {
          address,
          data: message.profileRequest,
          time: Date.now()
        })
        break
      }
      case 'profileResponse': {
        this.events.emit('profileResponse', {
          address,
          data: message.profileResponse,
          time: Date.now()
        })
        break
      }
      case 'profileVersion': {
        this.events.emit('profileMessage', {
          address,
          data: message.profileVersion,
          time: Date.now()
        })
        break
      }
    }
  }

  private async sendMessage(reliable: boolean, topicMessage: proto.Packet) {
    if (Object.keys(topicMessage).length === 0) {
      throw new Error('Invalid message')
    }
    const bytes = proto.Packet.encode(topicMessage as any).finish()
    this.transport.send(bytes, { reliable })
  }
}
