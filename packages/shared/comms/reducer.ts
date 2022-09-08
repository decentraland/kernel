import { AnyAction } from 'redux'

import { COMMS_ESTABLISHED } from 'shared/loading/types'

import { CommsState } from './types'
import { SET_COMMS_ISLAND, SET_WORLD_CONTEXT } from './actions'

const INITIAL_COMMS: CommsState = {
  initialized: false,
  context: undefined
}

export function commsReducer(state?: CommsState, action?: AnyAction): CommsState {
  if (!state) {
    return INITIAL_COMMS
  }
  if (!action) {
    return state
  }
  switch (action.type) {
    case COMMS_ESTABLISHED:
      return { ...state, initialized: true }
    case SET_COMMS_ISLAND:
      return { ...state, island: action.payload.island }
    case SET_WORLD_CONTEXT:
      if (state.context === action.payload) {
        return state
      }
      return { ...state, context: action.payload, island: undefined }
    default:
      return state
  }
}
