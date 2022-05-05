import type { BannedUsers, CommsConfig, FeatureFlag, RootMetaState, WorldConfig } from './types'
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
export function getVariantContent(store: RootMetaState, featureName: string): string | undefined {
  const ff = getFeatureFlags(store)
  if (ff.variants[featureName] && ff.variants[featureName].payload) {
    return ff.variants[featureName].payload?.value
  }
  return undefined
}

export function getFeatureFlags(store: RootMetaState): FeatureFlag {
  const featureFlag: FeatureFlag = {
    flags: {},
    variants: {}
  }

  if (store?.meta?.config?.featureFlagsV2 !== undefined) {
    for (const feature in store?.meta?.config?.featureFlagsV2.flags) {
      const featureName = feature.replace('explorer-', '')
      featureFlag.flags[featureName] = store?.meta?.config?.featureFlagsV2.flags[feature]
    }

    for (const feature in store?.meta?.config?.featureFlagsV2.variants) {
      const featureName = feature.replace('explorer-', '')
      featureFlag.variants[featureName] = store?.meta?.config?.featureFlagsV2.variants[feature]
      featureFlag.variants[featureName].name = featureName
    }
  }
  if (location.search.length !== 0) {
    const flags = new URLSearchParams(location.search)
    flags.forEach((_, key) => {
      if (key.includes(`DISABLE_`)) {
        const featureName = key.replace('DISABLE_', '').toLowerCase()
        featureFlag.flags[featureName] = false
      } else if (key.includes(`ENABLE_`)) {
        const featureName = key.replace('ENABLE_', '').toLowerCase()
        featureFlag.flags[featureName] = true
      }
    })
  }
  return featureFlag
}

export const isFeatureEnabled = (store: RootMetaState, featureName: string, ifNotSet: boolean): boolean => {
  const queryParamFlag = toUrlFlag(featureName)
  if (location.search.includes(`DISABLE_${queryParamFlag}`)) {
    return false
  } else if (location.search.includes(`ENABLE_${queryParamFlag}`)) {
    return true
  } else {
    const featureFlag = store?.meta.config?.featureFlags?.[`explorer-${featureName}`]
    return featureFlag ?? ifNotSet
  }
}

export const getSynapseUrl = (store: RootMetaState): string =>
  store.meta.config.synapseUrl ?? 'https://synapse.decentraland.io'

/** Convert camel case to upper snake case */
function toUrlFlag(key: string) {
  const result = key.replace(/([A-Z])/g, ' $1')
  return result.split(' ').join('_').toUpperCase()
}

export const getCatalystNodesEndpoint = (store: RootMetaState): string | undefined =>
  store.meta.config.servers?.catalystsNodesEndpoint
