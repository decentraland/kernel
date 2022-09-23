import { AnyAction } from 'redux'

import { BffState } from './types'
import { SET_BFF } from './actions'

const INITIAL_COMMS: BffState = {
  bff: undefined
}

export function bffReducer(state?: BffState, action?: AnyAction): BffState {
  if (!state) {
    return INITIAL_COMMS
  }
  if (!action) {
    return state
  }
  switch (action.type) {
    case SET_BFF:
      if (state.bff === action.payload) {
        return state
      }
      return { ...state, bff: action.payload }
    default:
      return state
  }
}
