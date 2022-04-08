import type { ETHEREUM_NETWORK } from 'config'

export type Layer = {
  name: string
  usersCount: number
  maxUsers: number
  usersParcels?: [number, number][]
}

export enum ServerConnectionStatus {
  OK,
  UNREACHABLE
}

export type CatalystStatus = {
  name: string
  version: string
  layers?: Layer[]
  usersCount?: number
  maxUsers?: number
  usersParcels?: Parcel[]
  env: {
    catalystVersion: string
  }
}

type BaseCandidate = {
  protocol: string
  domain: string
  catalystName: string
  elapsed: number
  status: ServerConnectionStatus
  lighthouseVersion: string
  catalystVersion: string
}

export type Candidate = {
  type: 'islands-based'
  usersCount: number
  usersParcels?: Parcel[]
  maxUsers?: number
} & BaseCandidate

export type Parcel = [number, number]

export type LayerUserInfo = {
  userId: string
  peerId: string
  protocolVersion: number
  parcel?: Parcel
}

export type Realm = {
  protocol: string
  domain: string
  serverName: string
}

export type DaoState = {
  initialized: boolean
  network: ETHEREUM_NETWORK | null
  candidatesFetched: boolean
  fetchContentServer: string
  catalystServer: string
  updateContentServer: string
  commsServer: string
  resizeService: string
  hotScenesService: string
  exploreRealmsService: string
  poiService: string
  realm: Realm | undefined
  candidates: Candidate[]
  addedCandidates: Candidate[]
  commsStatus: CommsStatus
}

export type RootDaoState = {
  dao: DaoState
}

export type CommsState =
  | 'initial'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'realm-full'
  | 'reconnection-error'
  | 'id-taken'
  | 'disconnecting'

export type CommsStatus = {
  status: CommsState
  connectedPeers: number
}

export type PingResult = {
  elapsed?: number
  status?: ServerConnectionStatus
  result?: CatalystStatus
}

export enum HealthStatus {
  HEALTHY = 'Healthy',
  UNHEALTHY = 'Unhealthy',
  DOWN = 'Down'
}
