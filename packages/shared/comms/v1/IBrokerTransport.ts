import { Observable } from 'decentraland-ecs'
import { Stats } from '../debug'

export type TransportMessage = {
  data: Uint8Array
  topic: string
}

export interface IBrokerTransport {
  stats: Stats | null
  readonly connectedPromise: Promise<void>

  onMessageObservable: Observable<TransportMessage>
  send(data: Uint8Array, reliable: boolean): void

  connect(): Promise<void>
  disconnect(): Promise<void>
}
