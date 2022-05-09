import { Message } from 'google-protobuf'
import { ILogger, createLogger } from 'shared/logger'
import { Observable } from 'mz-observable'
import { Transport, TransportMessage } from './Transport'
import { LivekitTransport as Livekit } from '@dcl/comms3-livekit-transport'

export class LivekitTransport implements Transport {
  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()
  public logger: ILogger = createLogger('LivekitTransport: ')

  private livekit: Livekit

  constructor(connStr: string) {
    const [url, params] = connStr.split('?')
    const token = new URLSearchParams(params).get('access_token')
    if (!token) {
      throw new Error('No access token')
    }

    const config = {
      url: url,
      token: token,
      logger: this.logger,
      handleDataReceived: this.handleMessage.bind(this),
      handleDisconnect: this.disconnect.bind(this)
    }
    this.livekit = new Livekit(config)
  }

  async connect(): Promise<void> {
    await this.livekit.connect()
    this.logger.log('Connected')
  }

  async send(msg: Message, reliable: boolean): Promise<void> {
    const data = msg.serializeBinary()
    if (reliable) {
      this.livekit.publishReliableData(data)
    } else {
      this.livekit.publishUnreliableData(data)
    }
  }

  async sendIdentity(msg: Message, reliable: boolean): Promise<void> {
    this.send(msg, reliable)
  }

  async disconnect() {
    await this.livekit.disconnect()
    this.onDisconnectObservable.notifyObservers()
  }

  handleMessage(peerId: string, data: Uint8Array) {
    this.onMessageObservable.notifyObservers({
      peer: peerId,
      data: data
    })
  }
}
