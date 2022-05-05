import { call, put, select, take } from 'redux-saga/effects'
import {
  ETHEREUM_NETWORK,
  FORCE_RENDERING_STYLE,
  getAssetBundlesBaseUrl,
  getServerConfigurations,
  QS_MAX_VISIBLE_PEERS
} from 'config'
import { META_CONFIGURATION_INITIALIZED, metaConfigurationInitialized } from './actions'
import defaultLogger from '../logger'
import { BannedUsers, MetaConfiguration, WorldConfig } from './types'
import { isMetaConfigurationInitiazed } from './selectors'
import { getSelectedNetwork } from 'shared/dao/selectors'
import { SELECT_NETWORK } from 'shared/dao/actions'
import { AlgorithmChainConfig } from 'shared/dao/pick-realm-algorithm/types'
import { RootState } from 'shared/store/rootTypes'
import { DEFAULT_MAX_VISIBLE_PEERS } from '.'

function valueFromVariants<T>(variants: Record<string, any> | undefined, key: string): T | undefined {
  const variant = variants?.[key]
  if (variant && variant.enabled) {
    try {
      return JSON.parse(variant.payload.value)
    } catch (e) {
      defaultLogger.warn(`Couldn't parse value for ${key} from variants. The variants response was: `, variants)
    }
  }
}

function bannedUsersFromVariants(variants: Record<string, any> | undefined): BannedUsers | undefined {
  return valueFromVariants(variants, 'explorer-banned_users')
}

function pickRealmAlgorithmConfigFromVariants(
  variants: Record<string, any> | undefined
): AlgorithmChainConfig | undefined {
  return valueFromVariants(variants, 'explorer-pick_realm_algorithm_config')
}

export function* waitForMetaConfigurationInitialization() {
  const configInitialized: boolean = yield select(isMetaConfigurationInitiazed)
  if (!configInitialized) {
    yield take(META_CONFIGURATION_INITIALIZED)
  }
}

export function* waitForNetworkSelected() {
  while (!(yield select((state: RootState) => !!state.dao.network))) {
    yield take(SELECT_NETWORK)
  }
  const net: ETHEREUM_NETWORK = yield select(getSelectedNetwork)
  return net
}

function getMaxVisiblePeers(variants: Record<string, any> | undefined): number {
  if (QS_MAX_VISIBLE_PEERS !== undefined) return QS_MAX_VISIBLE_PEERS
  const fromVariants = valueFromVariants(variants, 'explorer-max_visible_peers')

  return typeof fromVariants === 'number' ? fromVariants : DEFAULT_MAX_VISIBLE_PEERS
}

function* initMeta() {
  const net: ETHEREUM_NETWORK = yield call(waitForNetworkSelected)

  const config: Partial<MetaConfiguration> = yield call(fetchMetaConfiguration, net)
  const flagsAndVariants: { flags: Record<string, boolean>; variants: Record<string, any> } | undefined = yield call(
    fetchFeatureFlagsAndVariants,
    net
  )

  const maxVisiblePeers = getMaxVisiblePeers(flagsAndVariants?.variants)

  const merge: Partial<MetaConfiguration> = {
    ...config,
    comms: {
      ...config.comms,
      maxVisiblePeers
    },
    featureFlags: flagsAndVariants?.flags,
    featureFlagsV2: flagsAndVariants,
    bannedUsers: bannedUsersFromVariants(flagsAndVariants?.variants),
    pickRealmAlgorithmConfig: pickRealmAlgorithmConfigFromVariants(flagsAndVariants?.variants)
  }

  if (FORCE_RENDERING_STYLE) {
    if (!merge.world) {
      merge.world = {} as WorldConfig
    }

    merge.world.renderProfile = FORCE_RENDERING_STYLE
  }

  yield put(metaConfigurationInitialized(merge))
}

export function* metaSaga(): any {
  yield call(initMeta)
}

async function fetchFeatureFlagsAndVariants(network: ETHEREUM_NETWORK): Promise<Record<string, boolean> | undefined> {
  const featureFlagsEndpoint = getServerConfigurations(network).explorerFeatureFlags
  try {
    const response = await fetch(featureFlagsEndpoint, {
      credentials: 'include'
    })
    if (response.ok) {
      return response.json()
    }
  } catch (e) {
    defaultLogger.warn(`Error while fetching feature flags from '${featureFlagsEndpoint}'. Using default config`)
  }
}

async function fetchMetaConfiguration(network: ETHEREUM_NETWORK) {
  const explorerConfigurationEndpoint = getServerConfigurations(network).explorerConfiguration
  try {
    const response = await fetch(explorerConfigurationEndpoint)
    if (response.ok) {
      return response.json()
    }
    throw new Error('Meta Response Not Ok')
  } catch (e) {
    defaultLogger.warn(
      `Error while fetching meta configuration from '${explorerConfigurationEndpoint}' using default config`
    )
    return {
      explorer: {
        minBuildNumber: 0,
        assetBundlesFetchUrl: getAssetBundlesBaseUrl(network)
      },
      servers: {
        added: [],
        denied: [],
        contentWhitelist: []
      },
      bannedUsers: {},
      synapseUrl:
        network === ETHEREUM_NETWORK.MAINNET ? 'https://synapse.decentraland.org' : 'https://synapse.decentraland.io',
      world: {
        pois: []
      },
      comms: {
        targetConnections: 4,
        maxConnections: 6
      }
    }
  }
}
