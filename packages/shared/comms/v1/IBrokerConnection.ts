import { Observable } from 'mz-observable'
import { Stats } from '../../comms/debug'

export type BrokerMessage = {
  data: Uint8Array
  topic: string
}

export interface IBrokerConnection {
  stats: Stats | null
  onMessageObservable: Observable<BrokerMessage>

  readonly connectedPromise: Promise<void>

  send(data: Uint8Array, reliable: boolean): void
  setTopics(topics: string[]): void
  close(): Promise<void>

  printDebugInformation(): void
}
