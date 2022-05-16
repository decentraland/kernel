import { Message } from 'google-protobuf'
import { Observable } from 'mz-observable'

export type TransportMessage = {
  data: Uint8Array
  peer: string
}

export type SendOpts = {
  reliable: boolean

  /*
    NOTE: identity is a hint to the transport, the transport may choose to augment
    the message with peer identity data if the protocol itself doesn't have its
    own way of identifying the peer
  */
  identity?: boolean
}

export interface Transport {
  onDisconnectObservable: Observable<void>
  onMessageObservable: Observable<TransportMessage>

  connect(): Promise<void>
  send(msg: Message, opts: SendOpts): Promise<void>
  disconnect(): Promise<void>
}
