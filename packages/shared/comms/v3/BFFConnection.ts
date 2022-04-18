import { ILogger, createLogger } from 'shared/logger'
import { Observable } from 'mz-observable'
import { Message } from 'google-protobuf'
import {
  MessageType,
  HeartBeatMessage,
  SubscriptionMessage,
  TopicMessage,
  MessageHeader,
  MessageTypeMap
} from './proto/bff_pb'
import { Category, WorldPositionData } from './proto/comms_pb'
import { PeerConfig } from '@dcl/catalyst-peer'

export class BFFConnection {
  public logger: ILogger = createLogger('BFF: ')

  public onDisconnectObservable = new Observable<void>()
  public onTopicMessageObservable = new Observable<Uint8Array>()

  private ws: WebSocket | null = null
  private heartBeatInterval: any = null

  constructor(public url: string, private config: PeerConfig) {}

  async connect(): Promise<void> {
    await this.connectWS()
    this.heartBeatInterval = setInterval(() => {
      const msg = new HeartBeatMessage()
      msg.setType(MessageType.HEARTBEAT)
      msg.setTime(Date.now())

      const data = new WorldPositionData()
      data.setCategory(Category.WORLD_POSITION)
      data.setTime(Date.now())

      const position = this.config.positionConfig?.selfPosition()
      if (position) {
        data.setPositionX(position[0])
        data.setPositionY(position[1])
        data.setPositionZ(position[2])

        msg.setData(data.serializeBinary())

        this.send(msg.serializeBinary())
      }
    }, 10000)
    this.logger.log('Connected')
  }

  sendTopicMessage(topic: string, body: Message) {
    const encodedBody = body.serializeBinary()

    const message = new TopicMessage()
    message.setType(MessageType.TOPIC)
    message.setTopic(topic)
    message.setBody(encodedBody)

    this.send(message.serializeBinary())
  }

  async setTopics(rawTopics: string[]) {
    const subscriptionMessage = new SubscriptionMessage()
    subscriptionMessage.setType(MessageType.SUBSCRIPTION)
    // TODO: use TextDecoder instead of Buffer, it is a native browser API, works faster
    subscriptionMessage.setTopics(Buffer.from(rawTopics.join(' '), 'utf8'))
    const bytes = subscriptionMessage.serializeBinary()
    this.send(bytes)
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.ws) throw new Error('This transport is closed')

    this.ws.send(data)
  }

  async disconnect() {
    if (this.heartBeatInterval) {
      clearInterval(this.heartBeatInterval)
    }
    if (this.ws) {
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
      this.onDisconnectObservable.notifyObservers()
    }
  }

  async onWsMessage(event: MessageEvent) {
    const data = new Uint8Array(event.data)

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
      case MessageType.TOPIC: {
        let dataMessage: TopicMessage
        try {
          dataMessage = TopicMessage.deserializeBinary(data)
        } catch (e) {
          this.logger.error('cannot process topic message', e)
          break
        }

        const body = dataMessage.getBody() as any
        this.onTopicMessageObservable.notifyObservers(body)
      }
      default: {
        this.logger.log('ignoring msgType', msgType)
        break
      }
    }
  }

  private connectWS(): Promise<void> {
    if (this.ws && this.ws.readyState === this.ws.OPEN) return Promise.resolve()

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(this.url, 'comms')
      this.ws.binaryType = 'arraybuffer'

      this.ws.onerror = (event) => {
        this.logger.error('socket error', event)
        this.disconnect().catch(this.logger.error)
        reject(event)
      }

      this.ws.onclose = () => {
        this.disconnect().catch(this.logger.error)
      }

      this.ws.onmessage = (event) => {
        this.onWsMessage(event).catch(this.logger.error)
      }

      resolve()
    })
  }
}
