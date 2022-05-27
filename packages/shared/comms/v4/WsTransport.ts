import { ILogger, createLogger } from 'shared/logger'
import { Transport, SendOpts } from './Transport'
import { Reader } from 'protobufjs/minimal'
import { WsMessage } from './proto/ws'

export class WsTransport extends Transport {
  private logger: ILogger = createLogger('WsTransport: ')
  private aliases: Record<number, string> = {}
  private ws: WebSocket | null = null

  constructor(public url: string) {
    super()
  }

  async connect(): Promise<void> {
    await this.connectWS()
    // TODO maybe I need a heartbeat here
    this.logger.log('Connected')
  }

  async send(body: Uint8Array, { identity }: SendOpts): Promise<void> {
    if (!this.ws) throw new Error('This transport is closed')

    const message: WsMessage = { data: undefined }

    const fromAlias = 0 // NOTE: this will be overriden by the server
    if (identity) {
      message.data = { $case: 'identityMessage', identityMessage: { body, fromAlias, identity: '' } }
    } else {
      message.data = { $case: 'systemMessage', systemMessage: { body, fromAlias } }
    }

    const d = WsMessage.encode(message).finish()
    this.ws.send(d)
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
    let message: WsMessage
    try {
      message = WsMessage.decode(Reader.create(new Uint8Array(event.data)))
    } catch (e: any) {
      this.logger.error(`cannot process message ${e.toString()}`)
      return
    }

    if (!message.data) {
      return
    }

    const { $case } = message.data

    switch ($case) {
      case 'systemMessage': {
        const { systemMessage } = message.data
        const userId = this.aliases[systemMessage.fromAlias]
        if (!userId) {
          this.logger.log('Ignoring system message from unkown peer')
          return
        }

        this.onMessageObservable.notifyObservers({
          peer: userId,
          payload: systemMessage.body
        })
        break
      }
      case 'identityMessage': {
        const { identityMessage } = message.data
        const userId = identityMessage.identity
        this.aliases[identityMessage.fromAlias] = userId

        this.onMessageObservable.notifyObservers({
          peer: userId,
          payload: identityMessage.body
        })
        break
      }
      default: {
        this.logger.log(`ignoring msg ${$case}`)
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
