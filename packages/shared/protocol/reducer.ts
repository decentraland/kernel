import { ProtocolState } from './types'
import { SetWorldContextAction, SET_WORLD_CONTEXT } from './actions'

export function protocolReducer(state?: ProtocolState, action?: SetWorldContextAction): ProtocolState {
  if (!state) {
    return { context: undefined, prevContext: undefined }
  }
  if (!action) {
    return state
  }
  switch (action.type) {
    case SET_WORLD_CONTEXT:
      if (state.context === action.payload) {
        return state
      }
      return { ...state, context: action.payload, prevContext: state.context }
  }
  return state
}
