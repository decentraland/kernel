import { BannedUsers, CommsConfig, FeatureFlags, MessageOfTheDayConfig, RootMetaState } from './types'
import { Vector2Component } from 'atomicHelpers/landHelpers'
import { AlgorithmChainConfig } from 'shared/dao/pick-realm-algorithm/types'

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

export const getPois = (store: RootMetaState): Vector2Component[] => store.meta.config.world?.pois || []

export const getCommsConfig = (store: RootMetaState): CommsConfig => store.meta.config.comms ?? {}

export const getBannedUsers = (store: RootMetaState): BannedUsers => store.meta.config.bannedUsers ?? {}

export const getPickRealmsAlgorithmConfig = (store: RootMetaState): AlgorithmChainConfig | undefined => store.meta.config.pickRealmAlgorithmConfig

export const isMOTDInitialized = (store: RootMetaState): boolean =>
  store.meta.config.world ? store.meta.config.world?.messageOfTheDayInit || false : false
export const getMessageOfTheDay = (store: RootMetaState): MessageOfTheDayConfig | null =>
  store.meta.config.world ? store.meta.config.world.messageOfTheDay || null : null

export const isFeatureEnabled = (store: RootMetaState, featureName: FeatureFlags, ifNotSet: boolean): boolean => {
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
