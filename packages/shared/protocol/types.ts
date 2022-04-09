import type { CommsContext } from '../comms/context'

export type RootProtocolState = {
  protocol: ProtocolState
}

export type ProtocolState = {
  context: CommsContext | undefined
  prevContext: CommsContext | undefined
}
