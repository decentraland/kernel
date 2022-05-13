import type { BannedUsers, CommsConfig, FeatureFlag, FeatureFlagsName, RootMetaState, WorldConfig } from './types'
import type { Vector2Component } from 'atomicHelpers/landHelpers'
import { AlgorithmChainConfig } from 'shared/dao/pick-realm-algorithm/types'
import { DEFAULT_MAX_VISIBLE_PEERS } from '.'

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

export const getBannedUsers = (store: RootMetaState): BannedUsers => store.meta.config.bannedUsers ?? {}

export const getPickRealmsAlgorithmConfig = (store: RootMetaState): AlgorithmChainConfig | undefined =>
  store.meta.config.pickRealmAlgorithmConfig

/**
 * Returns the variant content of a feature flag
 */
export function getVariantContent(store: RootMetaState, featureName: FeatureFlagsName): string | undefined {
  const ff = getFeatureFlags(store)
  if (ff.variants[featureName] && ff.variants[featureName]?.payload) {
    return ff.variants[featureName]?.payload?.value
  }
  return undefined
}

/**
 * Returns the feature flag value
 */
export function getFeatureFlagActivated(store: RootMetaState, featureName: FeatureFlagsName): boolean {
  const ff = getFeatureFlags(store)
  if (ff.flags[featureName]) {
    return ff.flags[featureName] || false
  }
  return false
}

export function getFeatureFlags(store: RootMetaState): FeatureFlag {
  const featureFlag: FeatureFlag = {
    flags: {},
    variants: {}
  }

  if (store?.meta?.config?.featureFlagsV2 !== undefined) {
    for (const feature in store?.meta?.config?.featureFlagsV2.flags) {
      const featureName = feature.replace('explorer-', '') as FeatureFlagsName
      featureFlag.flags[featureName] = store?.meta?.config?.featureFlagsV2.flags[feature as FeatureFlagsName]
    }

    for (const feature in store?.meta?.config?.featureFlagsV2.variants) {
      const featureName = feature.replace('explorer-', '') as FeatureFlagsName
      featureFlag.variants[featureName] = store?.meta?.config?.featureFlagsV2.variants[
        feature as FeatureFlagsName
      ] || {
        enabled: false,
        name: featureName
      }
      featureFlag.variants[featureName]!.name = featureName
    }
  }
  if (location.search.length !== 0) {
    const flags = new URLSearchParams(location.search)
    flags.forEach((_, key) => {
      if (key.startsWith(`DISABLE_`)) {
        const featureName = key.replace('DISABLE_', '').toLowerCase() as FeatureFlagsName
        featureFlag.flags[featureName] = false
      } else if (key.startsWith(`ENABLE_`)) {
        const featureName = key.replace('ENABLE_', '').toLowerCase() as FeatureFlagsName
        featureFlag.flags[featureName] = true
      }
    })
  }
  return featureFlag
}

export const getSynapseUrl = (store: RootMetaState): string =>
  store.meta.config.synapseUrl ?? 'https://synapse.decentraland.io'

export const getCatalystNodesEndpoint = (store: RootMetaState): string | undefined =>
  store.meta.config.servers?.catalystsNodesEndpoint
