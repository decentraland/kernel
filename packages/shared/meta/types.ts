import { Vector2Component } from 'atomicHelpers/landHelpers'
import { RenderProfile } from 'shared/types'
import { AlgorithmChainConfig } from 'shared/dao/pick-realm-algorithm/types'

export type MetaConfiguration = {
  explorer: {
    minBuildNumber: number
    assetBundlesFetchUrl: string
  }
  servers: {
    added: string[]
    denied: string[]
    contentWhitelist: string[]
    catalystsNodesEndpoint?: string
  }
  pickRealmAlgorithmConfig?: AlgorithmChainConfig
  bannedUsers: BannedUsers
  synapseUrl: string
  world: WorldConfig
  comms: CommsConfig
  minCatalystVersion?: string
  featureFlags?: Record<string, boolean>
  featureFlagsV2?: FeatureFlag
}

export type BannedUsers = Record<string, Ban[]>

export type Ban = {
  type: 'VOICE_CHAT_AND_CHAT' // For now we only handle one ban type
  expiration: number // Timestamp
}

export type WorldConfig = {
  pois: Vector2Component[]
  renderProfile?: RenderProfile
  enableNewTutorialCamera?: boolean
}

export type MetaState = {
  initialized: boolean
  config: Partial<MetaConfiguration>
}

export type RootMetaState = {
  meta: MetaState
}

export type CommsConfig = {
  targetConnections?: number
  maxConnections?: number
  relaySuspensionDisabled?: boolean
  relaySuspensionInterval?: number
  relaySuspensionDuration?: number
  maxVisiblePeers: number
}

export enum FeatureFlags {
  QUESTS = 'quests',
  BUILDER_IN_WORLD = 'builder_in_world',
  AVATAR_LODS = 'avatar_lods',
  ASSET_BUNDLES = 'asset_bundles',
  EXPLORE_V2_ENABLED = 'explorev2',
  UNSAFE_FETCH_AND_WEBSOCKET = 'unsafe-request'
}

export type FeatureFlag = {
  flags: Record<string, boolean>
  variants: Record<string, FeatureFlagVariant>
}

export type FeatureFlagVariant = {
  name: string
  enabled: boolean
  payload?: {
    type: string
    value: string
  }
}
