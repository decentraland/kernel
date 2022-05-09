import { Observable } from 'mz-observable'
import { Transport, TransportMessage } from './Transport'

export class DummyTransport implements Transport {
  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()

  async connect(): Promise<void> {}
  async send(): Promise<void> {}
  async sendIdentity(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
