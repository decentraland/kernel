import { Observable } from 'mz-observable'

export interface Transport {
  onDisconnectObservable: Observable<void>
  onMessageObservable: Observable<Uint8Array>

  send(data: Uint8Array, reliable: boolean): Promise<void>
  disconnect(): Promise<void>
}
