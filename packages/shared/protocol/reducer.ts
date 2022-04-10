import { SetWorldContextAction } from 'shared/comms/actions'
import { ProtocolState } from './types'

export function protocolReducer(state?: ProtocolState, action?: SetWorldContextAction): ProtocolState {
  if (!state) {
    return { context: undefined }
  }
  if (!action) {
    return state
  }
  return state
}
