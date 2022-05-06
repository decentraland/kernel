import { Message } from 'google-protobuf'
import { Observable } from 'mz-observable'
import { Position } from '../../comms/interface/utils'

export type TransportMessage = {
  data: Uint8Array
  peer: string
}

export interface Transport {
  onDisconnectObservable: Observable<void>
  onMessageObservable: Observable<TransportMessage>

  connect(): Promise<void>
  send(p: Position, msg: Message, reliable: boolean): Promise<void>
  sendIdentity(msg: Message, reliable: boolean, p?: Position): Promise<void>
  disconnect(): Promise<void>
}
