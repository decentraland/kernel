import { RootProtocolState } from './types'
import { CommsContext } from '../comms/context'

export function getCommsContext(state: RootProtocolState): CommsContext | undefined {
  return state.protocol.context
}

export function getPrevCommsContext(state: RootProtocolState): CommsContext | undefined {
  return state.protocol.prevContext
}
