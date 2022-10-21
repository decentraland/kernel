import { Position3D } from 'shared/comms/v3/types'

export type P2PLogConfig = {
  debugWebRtcEnabled: boolean
  debugUpdateNetwork: boolean
  debugIceCandidates: boolean
  debugMesh: boolean
}

export type KnownPeerData = {
  id: string
  position?: Position3D
}
