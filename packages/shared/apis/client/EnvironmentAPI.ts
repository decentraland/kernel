import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { EnvironmentData } from 'shared/types'
import { EnvironmentAPIServiceDefinition } from '../gen/EnvironmentAPI'

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

export async function createEnvironmentAPIServiceClient<Context>(clientPort: RpcClientPort) {
  const realService = await codegen.loadService<Context, EnvironmentAPIServiceDefinition>(
    clientPort,
    EnvironmentAPIServiceDefinition
  )
  return {
    ...realService,

    async getBootstrapData(): Promise<EnvironmentData<any>> {
      const res = await realService.realGetBootstrapData({})
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
      return (await realService.realAreUnsafeRequestAllowed({})).status
    },

    /**
     * Returns the current connected realm
     */
    async getCurrentRealm(): Promise<Realm | undefined> {
      const res = await realService.realGetCurrentRealm({})
      return res.currentRealm
    },

    /**
     * Returns whether the scene is running in preview mode or not
     */
    async isPreviewMode(): Promise<boolean> {
      const res = await realService.realIsPreviewMode({})
      return res.isPreview
    },

    /**
     * Returns explorer configuration and environment information
     */
    async getExplorerConfiguration(): Promise<ExplorerConfiguration> {
      return await realService.realGetExplorerConfiguration({})
    },

    /**
     * Returns what platform is running the scene
     */
    async getPlatform(): Promise<Platform> {
      return (await realService.realGetPlatform({})).platform as Platform
    },

    /**
     * Returns Decentraland's time
     */
    async getDecentralandTime(): Promise<{ seconds: number }> {
      return await realService.realGetDecentralandTime({})
    }
  }
}
