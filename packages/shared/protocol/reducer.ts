import { AnyAction } from 'redux'
import { ProtocolState } from './types'
import { SET_WORLD_CONTEXT } from './actions'
import { CommsContext } from '../comms/context'

export function protocolReducer(state?: ProtocolState, action?: AnyAction): ProtocolState {
  if (!state) {
    return { context: undefined }
  }
  if (!action) {
    return state
  }
  switch (action.type) {
    case SET_WORLD_CONTEXT:
      return { ...state, context: action.payload as CommsContext | undefined }
  }
  return state
}
