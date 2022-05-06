import { EnvironmentData } from 'shared/types'

export type EnvironmentRealm = {
  domain: string
  /** @deprecated use room instead */
  layer: string
  room: string
  serverName: string
  displayName: string
  protocol: string
}

export type ExplorerConfiguration = {
  clientUri: string
  configurations: Record<string, string | number | boolean>
}

export const enum Platform {
  DESKTOP = 'desktop',
  BROWSER = 'browser'
}

export interface IEnvironmentAPI {
  getBootstrapData(): Promise<EnvironmentData<any>>

  /**
   * Returns whether the scene is running in preview mode or not
   */
  isPreviewMode(): Promise<boolean>

  /**
   * Returns what platform is running the scene
   */
  getPlatform(): Promise<Platform>

  /**
   * Returns if the feature flag unsafe-request is on
   */
  areUnsafeRequestAllowed(): Promise<boolean>

  /**
   * Returns the current connected realm
   */
  getCurrentRealm(): Promise<EnvironmentRealm | undefined>

  /**
   * Returns explorer configuration and environment information
   */
  getExplorerConfiguration(): Promise<ExplorerConfiguration>

  /**
   * Returns Decentraland's time
   */
  getDecentralandTime(): Promise<{ seconds: number }>
}
