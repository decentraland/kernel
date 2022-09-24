import { IBff, RootBffState } from './types'

export const getBff = (state: RootBffState): IBff | undefined => state.bff.bff
