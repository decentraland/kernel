import { parcelLimits } from 'config'
import * as rfc4 from 'shared/protocol/kernel/comms/comms-rfc-4.gen'

export const MORDOR_POSITION_RFC4: rfc4.Position = {
  positionX: 1000 * parcelLimits.parcelSize,
  positionY: 1000,
  positionZ: 1000 * parcelLimits.parcelSize,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  rotationW: 1,
  index: 0
}

export type ProcessingPeerInfo = {
  alias: string
  squareDistance: number
}
