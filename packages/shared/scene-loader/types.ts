import { LoadableScene } from "shared/types"

export type SetDesiredScenesCommand = {
  scenes: LoadableScene[]
}

export type SceneLoaderPositionReport = {
  position: ReadOnlyVector2,
  loadingRadius: number
  teleported: boolean
}

export interface ISceneLoader {
  reportPosition(positionReport: SceneLoaderPositionReport): Promise<void>
  getCommands(): AsyncIterable<SetDesiredScenesCommand>
  fetchScenesByLocation(parcels: string[]): Promise<SetDesiredScenesCommand>
  stop(): Promise<void>
}

export type SceneLoaderState = {
  loader: ISceneLoader | undefined,
  positionSettled: boolean
  loadingRadius: number
  parcelPosition: ReadOnlyVector2
}

export type RootSceneLoaderState = {
  sceneLoader: SceneLoaderState
}
