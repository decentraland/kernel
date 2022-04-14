import { Observable } from 'mz-observable'
import { BFFConnection } from './BFFConnection'
import { Transport } from './Transport'

export class WsTransport implements Transport {
  public onDisconnectObservable: Observable<void>
  public onMessageObservable: Observable<Uint8Array>

  constructor(private bff: BFFConnection) {
    this.onDisconnectObservable = bff.onDisconnectObservable
    this.onMessageObservable = bff.onMessageObservable
  }

  async send(data: Uint8Array, _: boolean): Promise<void> {
    return this.bff.send(data)
  }

  async disconnect(): Promise<void> {
    return this.bff.disconnect()
  }
}
