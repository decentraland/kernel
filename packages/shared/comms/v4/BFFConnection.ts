import { ILogger, createLogger } from 'shared/logger'
import { Observable } from 'mz-observable'
import {
  MessageType,
  SubscriptionMessage,
  TopicMessage,
  MessageHeader,
  MessageTypeMap,
  OpenMessage,
  ValidationMessage,
  ValidationOKMessage
} from './proto/bff_pb'
import { HeartbeatMessage, IslandChangedMessage, Position3DMessage } from './proto/archipelago_pb'
import { Position3D } from './types'
import { AuthIdentity, Authenticator } from 'dcl-crypto'

export declare type BFFConfig = {
  selfPosition: () => Position3D | undefined
  getIdentity: () => AuthIdentity
}

export type TopicData = {
  peerId: string
  data: Uint8Array
}

export type IslandChangeData = {
  peerId: string
  connStr: string
  islandId: string
  peers: Map<string, Position3D>
}

export type TopicListener = {
  topic: string
  handler: (data: Uint8Array, peerId?: string) => void
}

export class BFFConnection {
  public logger: ILogger = createLogger('BFF: ')

  public onDisconnectObservable = new Observable<void>()
  public onTopicMessageObservable = new Observable<TopicData>()
  public onIslandChangeObservable = new Observable<IslandChangeData>()

  private ws: WebSocket | null = null
  private heartBeatInterval: any = null
  private peerId: string | null = null
  private islandId: string | null = null
  private listeners = new Map<string, Set<TopicListener>>()

  private rawTopics: string[] = []

  constructor(public url: string, private config: BFFConfig) {}

  async connect(): Promise<void> {
    await this.connectWS()
    this.logger.log('Connected')
  }

  public addListener(topic: string, handler: (data: Uint8Array, peerId?: string) => void): TopicListener {
    const l = { topic, handler }
    const listeners = this.listeners.get(topic) || new Set<TopicListener>()
    listeners.add(l)
    this.listeners.set(topic, listeners)
    return l
  }

  public removeListener(l: TopicListener): void {
    const listeners = this.listeners.get(l.topic)
    if (listeners) {
      listeners.delete(l)
    }
  }

  public sendMessage(topic: string, body: Uint8Array) {
    const message = new TopicMessage()
    message.setType(MessageType.TOPIC)
    message.setTopic(topic)
    message.setBody(body)

    return this.send(message.serializeBinary())
  }

  // TODO: replace this method with a listener
  public async setTopics(rawTopics: string[]): Promise<void> {
    this.rawTopics = rawTopics
    return this.refreshTopics()
  }

  public refreshTopics(): Promise<void> {
    const subscriptionMessage = new SubscriptionMessage()
    subscriptionMessage.setType(MessageType.SUBSCRIPTION)

    const topics = new Set(this.rawTopics)
    this.listeners.forEach((_, topic) => {
      topics.add(topic)
    })

    subscriptionMessage.setTopicsList(Array.from(topics))
    const bytes = subscriptionMessage.serializeBinary()
    return this.send(bytes)
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

  private async send(data: Uint8Array): Promise<void> {
    if (!this.ws) throw new Error('This transport is closed')

    this.ws.send(data)
  }

  private async onWsMessage(event: MessageEvent) {
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
      case MessageType.OPEN: {
        let openMessage: OpenMessage
        try {
          openMessage = OpenMessage.deserializeBinary(data)
        } catch (e) {
          this.logger.error('cannot process open message', e)
          break
        }

        const signedPayload = Authenticator.signPayload(this.config.getIdentity(), openMessage.getPayload())
        const validationMessage = new ValidationMessage()
        validationMessage.setType(MessageType.VALIDATION)
        validationMessage.setEncodedPayload(JSON.stringify(signedPayload))
        await this.send(validationMessage.serializeBinary())
        break
      }
      case MessageType.VALIDATION_OK: {
        let validationOkMessage: ValidationOKMessage
        try {
          validationOkMessage = ValidationOKMessage.deserializeBinary(data)
        } catch (e) {
          this.logger.error('cannot process topic message', e)
          break
        }

        this.peerId = validationOkMessage.getPeerId()
        this.logger.log(`Validation ok, peer is ${this.peerId}`)

        const topic = `peer.${this.peerId}.heartbeat`
        this.heartBeatInterval = setInterval(() => {
          const positionMessage = new Position3DMessage()

          const position = this.config.selfPosition()
          if (position) {
            positionMessage.setX(position[0])
            positionMessage.setY(position[1])
            positionMessage.setZ(position[2])
            const msg = new HeartbeatMessage()
            msg.setPosition(positionMessage)
            return this.sendMessage(topic, msg.serializeBinary())
          }
        }, 2000)
        break
      }
      case MessageType.VALIDATION_FAILURE: {
        this.logger.log('validation failure, disconnecting bff')
        await this.disconnect()
        break
      }
      case MessageType.TOPIC: {
        let topicMessage: TopicMessage
        try {
          topicMessage = TopicMessage.deserializeBinary(data)
        } catch (e) {
          this.logger.error('cannot process topic message', e)
          break
        }
        const topic = topicMessage.getTopic()

        const fromPeerId = topicMessage.getPeerId()
        const body = topicMessage.getBody() as any
        if (this.peerId && topic === `peer.${this.peerId}.island_changed`) {
          let islandChangedMessage: IslandChangedMessage
          try {
            islandChangedMessage = IslandChangedMessage.deserializeBinary(body)
          } catch (e) {
            this.logger.error('cannot process island change message', e)
            break
          }

          const peers = new Map<string, Position3D>()
          islandChangedMessage.getPeersMap().forEach((p: Position3DMessage, peerId: string) => {
            if (peerId !== this.peerId) {
              peers.set(peerId, [p.getX(), p.getY(), p.getZ()])
            }
          })

          this.onIslandChangeObservable.notifyObservers({
            peerId: this.peerId,
            connStr: islandChangedMessage.getConnStr(),
            islandId: islandChangedMessage.getIslandId(),
            peers
          })
        } else if (this.listeners.has(topic)) {
          const listeners = this.listeners.get(topic)!
          listeners.forEach((listener) => {
            listener.handler(body, fromPeerId)
          })
        } else if (fromPeerId) {
          // TODO replace this with listeners
          this.onTopicMessageObservable.notifyObservers({
            peerId: fromPeerId,
            data: body
          })
        } else {
          this.logger.warn(
            `unhandled system topic message ${topic}, peerid is ${this.peerId}, islandId is ${this.islandId}`
          )
        }
        break
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
