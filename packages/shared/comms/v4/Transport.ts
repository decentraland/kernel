import { Observable } from 'mz-observable'
import { Position3D } from './types'

export type TransportMessage = {
  payload: Uint8Array
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

export abstract class Transport {
  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()

  abstract connect(): Promise<void>
  abstract send(msg: Uint8Array, opts: SendOpts): Promise<void>
  abstract disconnect(): Promise<void>

  onPeerPositionChange(_: string, __: Position3D): void {}
}
