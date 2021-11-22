import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'
import { ExposableAPI } from './ExposableAPI'
import { EnvironmentData } from 'shared/types'
import { getRealm, getSelectedNetwork } from 'shared/dao/selectors'
import { getServerConfigurations, PREVIEW } from 'config'
import { store } from 'shared/store/isolatedStore'
import { getCommsIsland } from 'shared/comms/selectors'

type EnvironmentRealm = {
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
   * Returns the current connected realm
   */
  @exposeMethod
  async getCurrentRealm(): Promise<EnvironmentRealm | undefined> {
    const realm = getRealm(store.getState())
    const island = getCommsIsland(store.getState()) ?? '' // We shouldn't send undefined because it would break contract

    if (!realm) {
      return undefined
    }
    const { domain, catalystName: serverName } = realm
    return {
      domain,
      layer: island,
      room: island,
      serverName,
      displayName: `${serverName}-${island}`
    }
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
