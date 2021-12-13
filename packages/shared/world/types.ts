import { ILand } from 'shared/types'

export enum IsolatedMode {
  BUILDER = 0 // Payload to use: BuilderIsolatedModeOptions
}

export type IsolatedModeOptions = {
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
