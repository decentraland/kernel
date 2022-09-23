import type { CommsContext } from './context'
import { RootCommsState } from './types'

export const getCommsIsland = (store: RootCommsState): string | undefined => store.comms.island
export const getCommsContext = (state: RootCommsState): CommsContext | undefined => state.comms.context
