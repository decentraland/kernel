import { action } from 'typesafe-actions'
import { SceneWorker } from './SceneWorker'

export const SET_CURRENT_SCENE = 'SET_CURRENT_SCENE'
export const setCurrentScene = (currentScene: SceneWorker | undefined, previousScene: SceneWorker | undefined) =>
  action(SET_CURRENT_SCENE, { currentScene, previousScene })
export type SetCurrentScene = ReturnType<typeof setCurrentScene>
