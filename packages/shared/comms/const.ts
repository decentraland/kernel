import { parcelLimits } from 'config'
import { Position } from './interface/utils'

export const MORDOR_POSITION: Position = [
  1000 * parcelLimits.parcelSize,
  1000,
  1000 * parcelLimits.parcelSize,
  0,
  0,
  0,
  0,
  true
]

export type ProcessingPeerInfo = {
  alias: string
  squareDistance: number
}
