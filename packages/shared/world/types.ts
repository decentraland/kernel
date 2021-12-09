import { ILand } from "shared/types"

export enum IsolatedMode {
  BUILDER = 0
}

export type IsolatedModeOptions = {
  /**
   * Whether or not we want a single scene to enter isolated mode.
   */
  mode: IsolatedMode,
  payload: any,
}

export type EndIsolatedModeOptions = {
  /**
   * Whether or not we want to preserve an scene
   */
   sceneId?: string,
}

export type BuilderIsolatedModeOptions = {

  sceneId?: string,
  land?: ILand,
  recreateScene?: boolean

}