import { future, IFuture } from 'fp-future'

import { MessageType, CoordinatorMessage, WelcomeMessage, ConnectMessage } from './proto/broker'
import { Stats } from '../debug'
import { TransportMessage, IBrokerTransport } from './IBrokerTransport'
import { ILogger, createLogger } from 'shared/logger'
import { Observable } from 'mz-observable'

export class CliBrokerConnection implements IBrokerTransport {
  public alias: number | null = null

  public stats: Stats | null = null

  public logger: ILogger = createLogger('Broker: ')

  public onMessageObservable = new Observable<TransportMessage>()
  public onDisconnect = new Observable<void>()

  private connected = future<void>()

  get connectedPromise(): IFuture<void> {
    return this.connected
  }

  private ws: WebSocket | null = null

  constructor(public url: string) {
    this.connectWS()
  }

  async connect(): Promise<void> {
    await this.connected
  }

  send(data: Uint8Array, _reliable: boolean) {
    this.sendCoordinatorMessage(data)
  }

  async disconnect() {
    if (this.ws) {
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
      this.onDisconnect.notifyObservers()
    }
  }

  async onWsMessage(event: MessageEvent) {
    const data = event.data
    const msg = new Uint8Array(data)
    const msgSize = msg.length

    const msgType = CoordinatorMessage.deserializeBinary(data).getType()

    switch (msgType) {
      case MessageType.WELCOME: {
        if (this.stats) {
          this.stats.others.incrementRecv(msgSize)
        }

        let message: WelcomeMessage
        try {
          message = WelcomeMessage.deserializeBinary(msg)
        } catch (e) {
          this.logger.error('cannot deserialize welcome client message', e, msg)
          break
        }

        this.alias = message.getAlias()
        this.logger.info('my alias is', this.alias)

        const connectMessage = new ConnectMessage()
        connectMessage.setType(MessageType.CONNECT)
        connectMessage.setToAlias(0)
        connectMessage.setFromAlias(this.alias)
        this.ws!.send(connectMessage.serializeBinary())
        this.connected.resolve()

        break
      }
      case MessageType.TOPIC_FW:
      case MessageType.TOPIC_IDENTITY_FW:
      case MessageType.PING: {
        if (this.stats) {
          this.stats.dispatchTopicDuration.start()
        }

        this.onMessageObservable.notifyObservers({
          channel: 'ws',
          data: msg
        })

        break
      }
      default: {
        if (this.stats) {
          this.stats.others.incrementRecv(msgSize)
        }
        this.logger.warn('Ignoring message type', msgType)
        break
      }
    }
  }

  private sendCoordinatorMessage(msg: Uint8Array) {
    if (!this.ws) throw new Error('This transport is closed')

    this.connected
      .then(() => {
        if (this.ws) this.ws.send(msg)
      })
      .catch(console.error)
  }

  private connectWS() {
    if (this.ws && this.ws.readyState === this.ws.OPEN) return

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.ws = new WebSocket(this.url, 'comms')
    this.connected = future()
    this.ws.binaryType = 'arraybuffer'

    this.ws.onerror = (event) => {
      this.logger.error('socket error', event)
      this.disconnect().catch(console.error)
    }

    this.ws.onclose = () => {
      this.disconnect().catch(console.error)
    }

    this.ws.onmessage = (event) => {
      this.onWsMessage(event).catch((err) => {
        this.logger.error(err)
      })
    }
  }
}
