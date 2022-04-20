import * as contractInfo from '@dcl/urn-resolver/dist/contracts'
import { getWorld } from '@dcl/schemas'
import { store } from 'shared/store/isolatedStore'

export const NETWORK_HZ = 10

export namespace interactionLimits {
  /**
   * click distance, this is the length of the ray/lens
   */
  export const clickDistance = 10
}

export namespace parcelLimits {
  // Maximum numbers for parcelScenes to prevent performance problems
  // Note that more limitations may be added to this with time
  // And we may also measure individual parcelScene performance (as
  // in webgl draw time) and disable parcelScenes based on that too,
  // Performance / anti-ddos work is a fluid area.

  // number of entities
  export const entities = 200

  // Number of faces (per parcel)
  export const triangles = 10000
  export const bodies = 300
  export const textures = 10
  export const materials = 20
  export const height = 20
  export const geometries = 200

  export const parcelSize = 16 /* meters */
  export const halfParcelSize = parcelSize / 2 /* meters */
  export const centimeter = 0.01

  // eslint-disable-next-line prefer-const
  export let visibleRadius = 4

  /**
   * @deprecated. This is still used to calculate a position hash, but shouln't be used for anything else.
   */
  export const maxParcelX = 150
  /** @deprecated */
  export const maxParcelZ = 150
  /** @deprecated */
  export const minParcelX = -150
  /** @deprecated */
  export const minParcelZ = -150

  export const descriptiveValidWorldRanges = getWorld()
    .validWorldRanges.map(
      (range) => `(X from ${range.xMin} to ${range.xMax}, and Y from ${range.yMin} to ${range.yMax})`
    )
    .join(' or ')
}
export namespace playerConfigurations {
  export const gravity = -0.2
  export const height = 1.6
  export const handFromBodyDistance = 0.5
  // The player speed
  export const speed = 2
  export const runningSpeed = 8
  // The player inertia
  export const inertia = 0.01
  // The mouse sensibility (lower is most sensible)
  export const angularSensibility = 500
}

export namespace visualConfigurations {
  export const fieldOfView = 75
  export const farDistance = parcelLimits.visibleRadius * parcelLimits.parcelSize

  export const near = 0.08
  export const far = farDistance
}

// Entry points
export const PREVIEW: boolean = !!(globalThis as any).preview
export const EDITOR: boolean = !!(globalThis as any).isEditor
export const WORLD_EXPLORER = !EDITOR && !PREVIEW

export const RENDERER_WS = location.search.includes('ws')

export const OPEN_AVATAR_EDITOR = location.search.includes('OPEN_AVATAR_EDITOR') && WORLD_EXPLORER

// Development
export const ENV_OVERRIDE = location.search.includes('ENV')
export const GIF_WORKERS = location.search.includes('GIF_WORKERS')

const qs = new URLSearchParams(location.search)

function ensureQueryStringUrl(value: string | null): string | null {
  if (!value) return null
  if (typeof value === 'string') return addHttpsIfNoProtocolIsSet(value)
  return addHttpsIfNoProtocolIsSet(value[0])
}
function ensureSingleString(value: string | string[] | null): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  return value[0]
}

// Comms
const USE_LOCAL_COMMS = location.search.includes('LOCAL_COMMS') || PREVIEW
export const COMMS =
  !qs.has('COMMS') && USE_LOCAL_COMMS ? 'v1' : qs.get('COMMS') ? ensureSingleString(qs.get('COMMS'))! : 'v2' // by default
export const COMMS_PROFILE_TIMEOUT = 10000

export const UPDATE_CONTENT_SERVICE = ensureQueryStringUrl(qs.get('UPDATE_CONTENT_SERVICE'))
export const FETCH_CONTENT_SERVICE = ensureQueryStringUrl(qs.get('FETCH_CONTENT_SERVICE'))
export const COMMS_SERVICE = ensureSingleString(qs.get('COMMS_SERVICE'))
export const HOTSCENES_SERVICE = ensureSingleString(qs.get('HOTSCENES_SERVICE'))
export const POI_SERVICE = ensureSingleString(qs.get('POI_SERVICE'))
export const PREFERED_ISLAND = ensureSingleString(qs.get('island'))

export const TRACE_RENDERER = ensureSingleString(qs.get('TRACE_RENDERER'))

export const LOS = ensureSingleString(qs.get('LOS'))

export const DEBUG = location.search.includes('DEBUG_MODE') || !!(global as any).mocha || PREVIEW || EDITOR
export const DEBUG_ANALYTICS = location.search.includes('DEBUG_ANALYTICS')
export const DEBUG_MOBILE = location.search.includes('DEBUG_MOBILE')
export const DEBUG_MESSAGES = location.search.includes('DEBUG_MESSAGES')
export const DEBUG_MESSAGES_QUEUE_PERF = location.search.includes('DEBUG_MESSAGES_QUEUE_PERF')
export const DEBUG_WS_MESSAGES = location.search.includes('DEBUG_WS_MESSAGES')
export const DEBUG_REDUX = location.search.includes('DEBUG_REDUX')
export const DEBUG_LOGIN = location.search.includes('DEBUG_LOGIN')
export const DEBUG_PM = location.search.includes('DEBUG_PM')
export const DEBUG_SCENE_LOG = DEBUG || location.search.includes('DEBUG_SCENE_LOG')
export const DEBUG_KERNEL_LOG = !PREVIEW || location.search.includes('DEBUG_KERNEL_LOG')
export const DEBUG_PREFIX = ensureSingleString(qs.get('DEBUG_PREFIX'))

export const RESET_TUTORIAL = location.search.includes('RESET_TUTORIAL')

export const ENGINE_DEBUG_PANEL = location.search.includes('ENGINE_DEBUG_PANEL')
export const SCENE_DEBUG_PANEL = location.search.includes('SCENE_DEBUG_PANEL') && !ENGINE_DEBUG_PANEL
export const SHOW_FPS_COUNTER = location.search.includes('SHOW_FPS_COUNTER') || DEBUG
export const HAS_INITIAL_POSITION_MARK = location.search.includes('position')
export const WSS_ENABLED = !!ensureSingleString(qs.get('ws'))
export const FORCE_SEND_MESSAGE = location.search.includes('FORCE_SEND_MESSAGE')

export const ASSET_BUNDLES_DOMAIN = ensureSingleString(qs.get('ASSET_BUNDLES_DOMAIN'))

export const QS_MAX_VISIBLE_PEERS =
  typeof qs.get('MAX_VISIBLE_PEERS') === 'string' ? parseInt(qs.get('MAX_VISIBLE_PEERS')!, 10) : undefined

export const BUILDER_SERVER_URL =
  ensureSingleString(qs.get('BUILDER_SERVER_URL')) ?? 'https://builder-api.decentraland.org/v1'

/**
 * Get the root URL and ensure not to end with slash
 * @returns Root URL with pathname where the index.html is served.
 */
export const rootURLPreviewMode = () => {
  return `${location.origin}${location.pathname}`.replace(/\/$/, '')
}

export const PIN_CATALYST = PREVIEW
  ? rootURLPreviewMode()
  : typeof qs.get('CATALYST') === 'string'
  ? addHttpsIfNoProtocolIsSet(qs.get('CATALYST')!)
  : undefined

export const FORCE_RENDERING_STYLE = ensureSingleString(qs.get('FORCE_RENDERING_STYLE')) as any

const META_CONFIG_URL = ensureSingleString(qs.get('META_CONFIG_URL'))

export namespace commConfigurations {
  export const debug = true
  export const commRadius = 4

  export const sendAnalytics = true

  export const peerTtlMs = 60000

  export const autoChangeRealmInterval =
    typeof qs.get('AUTO_CHANGE_INTERVAL') === 'string' ? parseInt(qs.get('AUTO_CHANGE_INTERVAL')!, 10) * 1000 : 40000

  export const defaultIceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:coturn-raw.decentraland.services:3478',
      credential: 'passworddcl',
      username: 'usernamedcl'
    }
  ]

  export const voiceChatUseHRTF = location.search.includes('VOICE_CHAT_USE_HRTF')
}

// take address from http://contracts.decentraland.org/addresses.json

export enum ETHEREUM_NETWORK {
  MAINNET = 'mainnet',
  ROPSTEN = 'ropsten'
}

export const knownTLDs = ['zone', 'org', 'today']

// return one of org zone today
export function getTLD() {
  if (ENV_OVERRIDE) {
    return location.search.match(/ENV=(\w+)/)![1]
  }
  const previsionalTld = location.hostname.match(/(\w+)$/)![0]
  if (knownTLDs.includes(previsionalTld)) return previsionalTld
  return 'org'
}

export const WITH_FIXED_COLLECTIONS =
  (qs.get('WITH_COLLECTIONS') && ensureSingleString(qs.get('WITH_COLLECTIONS'))) || ''
export const ENABLE_EMPTY_SCENES = !location.search.includes('DISABLE_EMPTY_SCENES')

export function getAssetBundlesBaseUrl(network: ETHEREUM_NETWORK): string {
  const state = store.getState()
  return (
    ASSET_BUNDLES_DOMAIN || state.meta.config.explorer?.assetBundlesFetchUrl || getDefaultAssetBundlesBaseUrl(network)
  )
}

function getDefaultAssetBundlesBaseUrl(network: ETHEREUM_NETWORK): string {
  const tld = network === ETHEREUM_NETWORK.MAINNET ? 'org' : 'zone'
  return `https://content-assets-as-bundle.decentraland.${tld}`
}

export function getServerConfigurations(network: ETHEREUM_NETWORK) {
  const tld = network === ETHEREUM_NETWORK.MAINNET ? 'org' : 'zone'

  const metaConfigBaseUrl = META_CONFIG_URL || `https://config.decentraland.${tld}/explorer.json`
  const metaFeatureFlagsBaseUrl = PREVIEW
    ? `${rootURLPreviewMode()}/feature-flags/explorer.json`
    : `https://feature-flags.decentraland.${tld}/explorer.json`

  const questsUrl =
    ensureSingleString(qs.get('QUESTS_SERVER_URL')) ?? `https://quests-api.decentraland.${network ? 'org' : 'io'}`

  return {
    explorerConfiguration: `${metaConfigBaseUrl}?t=${new Date().getTime()}`,
    explorerFeatureFlags: `${metaFeatureFlagsBaseUrl}?t=${new Date().getTime()}`,
    questsUrl
  }
}

function assertValue<T>(val: T | undefined | null): T {
  if (!val) throw new Error('Value is missing')
  return val
}

export namespace ethereumConfigurations {
  export const mainnet = {
    wss: 'wss://mainnet.infura.io/ws/v3/f54f2e10b59647778de06d884121f8fa',
    http: 'https://mainnet.infura.io/v3/f54f2e10b59647778de06d884121f8fa/',
    etherscan: 'https://etherscan.io',
    names: 'https://api.thegraph.com/subgraphs/name/decentraland/marketplace',

    // contracts
    LANDProxy: assertValue(contractInfo.mainnet.LANDProxy),
    EstateProxy: assertValue(contractInfo.mainnet.EstateProxy),
    CatalystProxy: assertValue(contractInfo.mainnet.CatalystProxy),
    MANAToken: assertValue(contractInfo.mainnet.MANAToken)
  }
  export const ropsten = {
    wss: 'wss://ropsten.infura.io/ws/v3/f54f2e10b59647778de06d884121f8fa',
    http: 'https://ropsten.infura.io/v3/f54f2e10b59647778de06d884121f8fa/',
    etherscan: 'https://ropsten.etherscan.io',
    names: 'https://api.thegraph.com/subgraphs/name/decentraland/marketplace-ropsten',

    // contracts
    LANDProxy: assertValue(contractInfo.ropsten.LANDProxy),
    EstateProxy: assertValue(contractInfo.ropsten.EstateProxy),
    CatalystProxy: assertValue(contractInfo.ropsten.CatalystProxy || contractInfo.ropsten.Catalyst),
    MANAToken: assertValue(contractInfo.ropsten.MANAToken)
  }
}

export const isRunningTest: boolean = (global as any)['isRunningTests'] === true

export const genericAvatarSnapshots = {
  body: '/images/image_not_found.png',
  face256: 'data:image/png;base64,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'
} as const

export function getCatalystNodesDefaultURL() {
  return `https://peer.decentraland.${getTLD()}/lambdas/contracts/servers`
}

function addHttpsIfNoProtocolIsSet(domain: string): string
function addHttpsIfNoProtocolIsSet(domain: undefined): undefined
function addHttpsIfNoProtocolIsSet(domain: null): null
function addHttpsIfNoProtocolIsSet(domain: any) {
  if (typeof domain === 'undefined' || domain === null) return domain
  if (!domain.startsWith('http')) {
    return `https://${domain}`
  }
  return domain
}
