import { LoadableScene } from 'shared/types'
import { SceneWorker } from './SceneWorker'

export type ParcelSceneLoadingState = {
  isWorldLoadingEnabled: boolean
  desiredParcelScenes: Map<string, LoadableScene>
}

export type WorldState = {
  currentScene: SceneWorker | undefined,
}

export type RootWorldRState = {
  world: WorldState
}
