import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'
import { ExposableAPI } from './ExposableAPI'
import { EnvironmentData } from 'shared/types'
import { getRealm, getSelectedNetwork } from 'shared/dao/selectors'
import { getServerConfigurations, PREVIEW, RENDERER_WS } from 'config'
import { store } from 'shared/store/isolatedStore'
import { getCommsIsland } from 'shared/comms/selectors'
import { Realm } from 'shared/dao/types'
import { isFeatureEnabled } from 'shared/meta/selectors'
import { FeatureFlags } from 'shared/meta/types'

export type EnvironmentRealm = {
  domain: string
  /** @deprecated use room instead */
  layer: string
  room: string
  serverName: string
  displayName: string
}

type ExplorerConfiguration = {
  clientUri: string
  configurations: Record<string, string | number | boolean>
}

enum Platform {
  DESKTOP = 'desktop',
  BROWSER = 'browser'
}

@registerAPI('EnvironmentAPI')
export class EnvironmentAPI extends ExposableAPI {
  data!: EnvironmentData<any>
  /**
   * Returns the coordinates and the definition of a parcel
   */
  @exposeMethod
  async getBootstrapData(): Promise<EnvironmentData<any>> {
    return this.data
  }

  /**
   * Returns whether the scene is running in preview mode or not
   */
  @exposeMethod
  async isPreviewMode(): Promise<boolean> {
    return PREVIEW
  }

  /**
   * Returns what platform is running the scene
   */
  @exposeMethod
  async getPlatform(): Promise<Platform> {
    if (RENDERER_WS) {
      return Platform.DESKTOP
    } else {
      return Platform.BROWSER
    }
  }

  /**
   * Returns if the feature flag unsafe-request is on
   */
  @exposeMethod
  async areUnsafeRequestAllowed(): Promise<boolean> {
    return isFeatureEnabled(store.getState(), FeatureFlags.UNSAFE_FETCH_AND_WEBSOCKET, false)
  }

  /**
   * Returns the current connected realm
   */
  @exposeMethod
  async getCurrentRealm(): Promise<EnvironmentRealm | undefined> {
    const realm = getRealm(store.getState())
    const island = getCommsIsland(store.getState()) ?? '' // We shouldn't send undefined because it would break contract

    if (!realm) {
      return undefined
    }

    return toEnvironmentRealmType(realm, island)
  }

  /**
   * Returns explorer configuration and environment information
   */
  @exposeMethod
  async getExplorerConfiguration(): Promise<ExplorerConfiguration> {
    return {
      clientUri: location.href,
      configurations: {
        questsServerUrl: getServerConfigurations(getSelectedNetwork(store.getState())).questsUrl
      }
    }
  }
}

export function toEnvironmentRealmType(realm: Realm, island: string): EnvironmentRealm {
  const { domain, catalystName: serverName } = realm
  return {
    domain,
    layer: island,
    room: island,
    serverName,
    displayName: `${serverName}-${island}`
  }
}
