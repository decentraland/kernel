import { Message } from 'google-protobuf'
import { Observable } from 'mz-observable'

export type TransportMessage = {
  data: Uint8Array
  peer: string
}

export interface Transport {
  onDisconnectObservable: Observable<void>
  onMessageObservable: Observable<TransportMessage>

  connect(): Promise<void>
  send(msg: Message, reliable: boolean): Promise<void>
  sendIdentity(msg: Message, reliable: boolean): Promise<void>
  disconnect(): Promise<void>
}
