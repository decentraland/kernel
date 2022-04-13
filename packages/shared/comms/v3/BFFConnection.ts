import { future, IFuture } from 'fp-future'

import { ILogger, createLogger } from 'shared/logger'
import { Observable } from 'mz-observable'

export class BFFConnection {
  public alias: number | null = null

  public logger: ILogger = createLogger('BFF: ')

  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<Uint8Array>()

  private connected = future<void>()

  get connectedPromise(): IFuture<void> {
    return this.connected
  }

  private ws: WebSocket | null = null

  constructor(public url: string) { }

  async connect(): Promise<void> {
    await this.connectWS()
  }

  send(data: Uint8Array, _reliable: boolean) {
    if (!this.ws) throw new Error('This transport is closed')

    this.connected
      .then(() => {
        if (this.ws) this.ws.send(data)
      })
      .catch(console.error)
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
    const msg = new Uint8Array(event.data)

    this.onMessageObservable.notifyObservers(msg)
  }

  private connectWS(): Promise<void> {
    if (this.ws && this.ws.readyState === this.ws.OPEN) return Promise.resolve()

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(this.url, 'comms')
      this.connected = future()
      this.ws.binaryType = 'arraybuffer'

      this.connected.then(resolve).catch(this.logger.error)

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
    })
  }
}
