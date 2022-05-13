import { call, put, select, take } from 'redux-saga/effects'
import {
  ETHEREUM_NETWORK,
  FORCE_RENDERING_STYLE,
  getAssetBundlesBaseUrl,
  getServerConfigurations,
  PREVIEW,
  rootURLPreviewMode
} from 'config'
import { META_CONFIGURATION_INITIALIZED, metaConfigurationInitialized } from './actions'
import defaultLogger from '../logger'
import { FeatureFlagsName, MetaConfiguration, WorldConfig } from './types'
import { getMaxVisiblePeers, isMetaConfigurationInitiazed } from './selectors'
import { getSelectedNetwork } from 'shared/dao/selectors'
import { SELECT_NETWORK } from 'shared/dao/actions'
import { RootState } from 'shared/store/rootTypes'
import { FeatureFlagsResult, fetchFlags } from '@dcl/feature-flags'

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

function* initMeta() {
  const net: ETHEREUM_NETWORK = yield call(waitForNetworkSelected)

  const config: Partial<MetaConfiguration> = yield call(fetchMetaConfiguration, net)
  const flagsAndVariants: FeatureFlagsResult = yield call(fetchFeatureFlagsAndVariants, net)
  const maxVisiblePeers: number = yield select(getMaxVisiblePeers)

  const merge: Partial<MetaConfiguration> = {
    ...config,
    comms: {
      ...config.comms,
      maxVisiblePeers
    },
    featureFlagsV2: flagsAndVariants
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

async function fetchFeatureFlagsAndVariants(network: ETHEREUM_NETWORK): Promise<FeatureFlagsResult> {
  const tld = network === ETHEREUM_NETWORK.MAINNET ? 'org' : 'zone'

  const explorerFeatureFlags = PREVIEW
    ? `${rootURLPreviewMode()}/feature-flags`
    : `https://feature-flags.decentraland.${tld}`

  const flagsAndVariants = await fetchFlags({ applicationName: 'explorer', featureFlagsUrl: explorerFeatureFlags })

  for (const key in flagsAndVariants.flags) {
    const value = flagsAndVariants.flags[key]
    delete flagsAndVariants.flags[key]
    flagsAndVariants.flags[key.replace(/^explorer-/, '')] = value
  }

  for (const key in flagsAndVariants.variants) {
    const value = flagsAndVariants.variants[key]
    delete flagsAndVariants.variants[key]
    value.name = key.replace(/^explorer-/, '')
    flagsAndVariants.variants[value.name] = value
  }

  if (location.search.length !== 0) {
    const flags = new URLSearchParams(location.search)
    flags.forEach((_, key) => {
      if (key.startsWith(`DISABLE_`)) {
        const featureName = key.replace('DISABLE_', '').toLowerCase() as FeatureFlagsName
        flagsAndVariants.flags[featureName] = false
        if (featureName in flagsAndVariants.variants) {
          flagsAndVariants.variants[featureName].enabled = false
        }
      } else if (key.startsWith(`ENABLE_`)) {
        const featureName = key.replace('ENABLE_', '').toLowerCase() as FeatureFlagsName
        flagsAndVariants.flags[featureName] = true
        if (featureName in flagsAndVariants.variants) {
          flagsAndVariants.variants[featureName].enabled = true
        } else {
        }
      }
    })
  }

  return flagsAndVariants
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
