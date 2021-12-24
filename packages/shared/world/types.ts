import { LifecycleManager } from 'decentraland-loader/lifecycle/manager'
import { ILand } from 'shared/types'

export type ParcelSceneLoadingState = {
  isWorldLoadingEnabled: boolean
  desiredParcelScenes: Set<string>
  lifecycleManager: LifecycleManager | null
  runningIsolatedMode: boolean
  isolatedModeOptions: IsolatedModeOptions | null
}

export enum IsolatedMode {
  BUILDER = 0 // Payload to use: BuilderIsolatedModeOptions
}

export type IsolatedModeOptions<T = any> = {
  mode: IsolatedMode
  payload: any
}

// This is the payload that the builder mode will use
export type BuilderIsolatedModeOptions = {
  sceneId?: string
  land?: ILand

  /**
   * Whether or not we want a single scene to enter isolated mode.
   */
  recreateScene?: boolean
}

export type StatefulWorkerOptions = {
  isEmpty: boolean
}
