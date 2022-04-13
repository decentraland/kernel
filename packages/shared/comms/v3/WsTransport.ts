import { Observable } from 'mz-observable'
import { Transport } from './Transport'

export class WsTransport implements Transport {
  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<Uint8Array>()

  async send(data: Uint8Array, reliable: boolean): Promise<void> {
  }

  async disconnect(): Promise<void> {

  }
}
