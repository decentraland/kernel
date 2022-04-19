import { Message } from 'google-protobuf'
import { ILogger, createLogger } from 'shared/logger'
import { Observable } from 'mz-observable'
import { Transport, TransportMessage } from './Transport'
import { MessageType, MessageHeader, MessageTypeMap, SystemMessage, IdentityMessage } from './proto/ws_pb'

export class WsTransport implements Transport {
  aliases: Record<number, string> = {}

  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()
  public logger: ILogger = createLogger('WsTransport: ')

  private ws: WebSocket | null = null

  constructor(public url: string) {}

  async connect(): Promise<void> {
    await this.connectWS()
    // TODO maybe I need a heartbeat here
    this.logger.log('Connected')
  }

  async send(msg: Message, _: boolean): Promise<void> {
    if (!this.ws) throw new Error('This transport is closed')

    const d = new SystemMessage()
    d.setType(MessageType.SYSTEM)
    d.setBody(msg.serializeBinary())
    this.ws.send(d.serializeBinary())
  }

  async sendIdentity(msg: Message, _: boolean): Promise<void> {
    if (!this.ws) throw new Error('This transport is closed')

    const d = new IdentityMessage()
    d.setType(MessageType.IDENTITY)
    d.setBody(msg.serializeBinary())
    this.ws.send(d.serializeBinary())
  }

  async disconnect() {
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
      case MessageType.WELCOME: {
        // TODO: not used?
      }
      case MessageType.SYSTEM: {
        let dataMessage: SystemMessage
        try {
          dataMessage = SystemMessage.deserializeBinary(data)
        } catch (e) {
          this.logger.error('cannot process system message', e)
          break
        }

        const userId = this.aliases[dataMessage.getFromAlias()]
        if (!userId) {
          this.logger.log('Ignoring system message from unkown peer')
          return
        }

        const body = dataMessage.getBody() as any
        this.onMessageObservable.notifyObservers({
          peer: userId,
          data: body
        })
        break
      }
      case MessageType.IDENTITY: {
        let dataMessage: IdentityMessage
        try {
          dataMessage = IdentityMessage.deserializeBinary(data)
        } catch (e) {
          this.logger.error('cannot process identity message', e)
          break
        }

        const userId = atob(dataMessage.getIdentity_asB64())
        this.aliases[dataMessage.getFromAlias()] = userId

        const body = dataMessage.getBody() as any
        this.onMessageObservable.notifyObservers({
          peer: userId,
          data: body
        })
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

      this.ws.onopen = () => {
        resolve()
      }
    })
  }
}
