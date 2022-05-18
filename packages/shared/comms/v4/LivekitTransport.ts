import { ILogger, createLogger } from 'shared/logger'
import { SendOpts, Transport } from './Transport'
import { LivekitTransport as Livekit } from '@dcl/comms3-livekit-transport'

export class LivekitTransport extends Transport {
  private logger: ILogger = createLogger('CommsV4:LivekitTransport: ')
  private livekit: Livekit

  constructor(connStr: string) {
    super()
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

  send(data: Uint8Array, { reliable }: SendOpts): Promise<void> {
    if (reliable) {
      return this.livekit.publishReliableData(data)
    } else {
      return this.livekit.publishUnreliableData(data)
    }
  }

  async disconnect() {
    await this.livekit.disconnect()
    this.onDisconnectObservable.notifyObservers()
  }

  handleMessage(peerId: string, data: Uint8Array) {
    this.onMessageObservable.notifyObservers({
      peer: peerId,
      payload: data
    })
  }
}
