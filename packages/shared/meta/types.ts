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

export type FeatureFlagsName =
  | 'quests' // quests feature
  | 'retry_matrix_login' // retry matrix reconnection
  | 'parcel-denylist' // denylist of specific parcels using variants
  | 'matrix_disabled' // disable matrix integration entirely
  | 'builder_in_world'
  | 'avatar_lods'
  | 'asset_bundles'
  | 'explorev2'
  | 'unsafe-request'

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

export type FeatureFlag = {
  flags: Partial<Record<FeatureFlagsName, boolean>>
  variants: Partial<Record<FeatureFlagsName, FeatureFlagVariant>>
}

export type FeatureFlagVariant = {
  name: FeatureFlagsName
  enabled: boolean
  payload?: {
    type: string
    value: string
  }
}
