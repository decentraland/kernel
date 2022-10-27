import { rotateUsingQuaternion } from 'shared/comms/interface/utils'
import { VoiceSpatialParams } from './VoiceCommunicator'
import * as rfc4 from '@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen'

export function getSpatialParamsFor(position: rfc4.Position): VoiceSpatialParams {
  return {
    position: [position.positionX, position.positionY, position.positionZ],
    orientation: rotateUsingQuaternion(position, 0, 0, -1)
  }
}

export function isChrome() {
  return window.navigator.userAgent.includes('Chrome')
}
