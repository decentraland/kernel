import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { EnvironmentData } from 'shared/types'
import { EnvironmentAPIServiceDefinition } from '../proto/EnvironmentAPI'

export type Realm = {
  domain: string
  /** @deprecated use room instead */
  layer: string
  room: string
  serverName: string
  displayName: string
}

export type ExplorerConfiguration = {
  clientUri: string
  configurations: Record<string, string | number | boolean>
}

export const enum Platform {
  DESKTOP = 'desktop',
  BROWSER = 'browser'
}

export function createEnvironmentAPIServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = codegen.loadService<Context, EnvironmentAPIServiceDefinition>(
    clientPort,
    EnvironmentAPIServiceDefinition
  )
  return {
    ...originalService,

    async getBootstrapData(): Promise<EnvironmentData<any>> {
      const res = await originalService.getBootstrapData({})
      return {
        sceneId: res.sceneId,
        name: res.name,
        main: res.main,
        baseUrl: res.baseUrl,
        mappings: res.mappings,
        useFPSThrottling: res.useFPSThrottling,
        data: JSON.parse(res.jsonPayload)
      }
    },

    /**
     * Returns if the feature flag unsafe-request is on
     */
    async areUnsafeRequestAllowed(): Promise<boolean> {
      return (await originalService.areUnsafeRequestAllowed({})).status
    },

    /**
     * Returns the current connected realm
     */
    async getCurrentRealm(): Promise<Realm | undefined> {
      const res = await originalService.getCurrentRealm({})
      return res.currentRealm
    },

    /**
     * Returns whether the scene is running in preview mode or not
     */
    async isPreviewMode(): Promise<boolean> {
      const res = await originalService.isPreviewMode({})
      return res.isPreview
    },

    /**
     * Returns explorer configuration and environment information
     */
    async getExplorerConfiguration(): Promise<ExplorerConfiguration> {
      return await originalService.getExplorerConfiguration({})
    },

    /**
     * Returns what platform is running the scene
     */
    async getPlatform(): Promise<Platform> {
      return (await originalService.getPlatform({})).platform as Platform
    },

    /**
     * Returns Decentraland's time
     */
    async getDecentralandTime(): Promise<{ seconds: number }> {
      return await originalService.getDecentralandTime({})
    }
  }
}
