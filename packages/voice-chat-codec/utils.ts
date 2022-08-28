import { Position, rotateUsingQuaternion } from 'shared/comms/interface/utils'
import { VoiceSpatialParams } from './VoiceCommunicator'

export function getSpatialParamsFor(position: Position): VoiceSpatialParams {
  return {
    position: position.slice(0, 3) as [number, number, number],
    orientation: rotateUsingQuaternion(position, 0, 0, -1)
  }
}
