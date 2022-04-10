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
  // connectionString: string
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
  hostname: string
  serverName: string
}

export type DaoState = {
  network: ETHEREUM_NETWORK | null
  candidatesFetched: boolean
  fetchContentServer: string
  catalystServer: string
  updateContentServer: string
  resizeService: string
  hotScenesService: string
  exploreRealmsService: string
  poiService: string
  candidates: Candidate[]
  addedCandidates: Candidate[]
}

export type RootDaoState = {
  dao: DaoState
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
