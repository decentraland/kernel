import type { BannedUsers, CommsConfig, FeatureFlag, FeatureFlagsName, RootMetaState, WorldConfig } from './types'
import type { Vector2Component } from 'atomicHelpers/landHelpers'
import { AlgorithmChainConfig } from 'shared/dao/pick-realm-algorithm/types'
import { DEFAULT_MAX_VISIBLE_PEERS } from '.'
import { QS_MAX_VISIBLE_PEERS } from 'config'

export const getAddedServers = (store: RootMetaState): string[] => {
  const { config } = store.meta

  if (!config || !config.servers || !config.servers.added) {
    return []
  }

  return config.servers.added
}

export const getContentWhitelist = (store: RootMetaState): string[] => {
  const { config } = store.meta

  if (!config || !config.servers || !config.servers.contentWhitelist) {
    return []
  }

  return config.servers.contentWhitelist
}

export const getMinCatalystVersion = (store: RootMetaState): string | undefined => {
  const { config } = store.meta

  return config.minCatalystVersion
}

export const isMetaConfigurationInitiazed = (store: RootMetaState): boolean => store.meta.initialized

export const getWorldConfig = (store: RootMetaState): WorldConfig => store.meta.config.world as WorldConfig

export const getPois = (store: RootMetaState): Vector2Component[] => getWorldConfig(store)?.pois || []

export const getCommsConfig = (store: RootMetaState): CommsConfig =>
  store.meta.config.comms ?? { maxVisiblePeers: DEFAULT_MAX_VISIBLE_PEERS }

export const getBannedUsers = (store: RootMetaState): BannedUsers =>
  (getFeatureFlagVariantValue(store, 'banned_users') as BannedUsers) ?? {}

export const getPickRealmsAlgorithmConfig = (store: RootMetaState): AlgorithmChainConfig | undefined =>
  getFeatureFlagVariantValue(store, 'pick_realm_algorithm_config') as AlgorithmChainConfig | undefined

export function getMaxVisiblePeers(store: RootMetaState): number {
  if (QS_MAX_VISIBLE_PEERS !== undefined) return QS_MAX_VISIBLE_PEERS
  const fromVariants = +(getFeatureFlagVariantValue(store, 'max_visible_peers') as string)

  return !isNaN(fromVariants) ? fromVariants : DEFAULT_MAX_VISIBLE_PEERS
}

/**
 * Returns the variant content of a feature flag
 */
export function getFeatureFlagVariantValue(store: RootMetaState, featureName: FeatureFlagsName): unknown {
  const ff = getFeatureFlags(store)
  const variant = ff.variants[featureName]?.payload
  if (variant) {
    try {
      if (variant.type === 'json') return JSON.parse(variant.value)
    } catch (e) {
      console.warn(`Couldn't parse value for ${featureName} from variants.`)
    }

    return variant.value
  }
  return undefined
}

/**
 * Returns the feature flag value
 */
export function getFeatureFlagEnabled(store: RootMetaState, featureName: FeatureFlagsName): boolean {
  const ff = getFeatureFlags(store)
  if (ff.flags[featureName]) {
    return ff.flags[featureName] || false
  }
  return false
}

export function getFeatureFlags(store: RootMetaState): FeatureFlag {
  return store.meta.config.featureFlagsV2 || { flags: {}, variants: {} }
}

export const getSynapseUrl = (store: RootMetaState): string =>
  store.meta.config.synapseUrl ?? 'https://synapse.decentraland.io'

export const getCatalystNodesEndpoint = (store: RootMetaState): string | undefined =>
  store.meta.config.servers?.catalystsNodesEndpoint
