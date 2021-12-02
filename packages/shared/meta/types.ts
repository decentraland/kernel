import { Vector2Component } from 'atomicHelpers/landHelpers'
import { RenderProfile } from 'shared/types'
import { Color4 } from 'decentraland-ecs'
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
  world: any
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
  messageOfTheDay?: MessageOfTheDayConfig | null
  messageOfTheDayInit?: boolean
  enableNewTutorialCamera?: boolean
}

export type MessageOfTheDayConfig = {
  background_banner: string
  endUnixTimestamp?: number
  title: string
  body: string
  buttons: {
    caption: string
    action?: string
    // NOTE(Brian): The button actions will be global chat's actions,
    // for instance `/goto 0,0`, or 'Close' that will just close the MOTD.
    tint?: Color4
  }[]
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
  EXPLORE_V2_ENABLED = 'explorev2'
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
