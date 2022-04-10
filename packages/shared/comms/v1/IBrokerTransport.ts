import { Observable } from 'mz-observable'
import { Stats } from '../debug'

export type TransportMessage = {
  data: Uint8Array
  channel: string
}

export enum SocketReadyState {
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED
}

export interface IBrokerTransport {
  stats: Stats | null
  onMessageObservable: Observable<TransportMessage>
  onDisconnectObservable: Observable<void>
  send(data: Uint8Array, reliable: boolean): void
  disconnect(): Promise<void>
  connect(): Promise<void>
}
