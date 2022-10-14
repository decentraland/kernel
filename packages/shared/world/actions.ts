import { action } from 'typesafe-actions'
import { SceneWorker } from './SceneWorker'

export const SET_CURRENT_SCENE = 'SET_CURRENT_SCENE'
export const setCurrentScene = (currentScene: SceneWorker | undefined, previousScene: SceneWorker | undefined) =>
  action(SET_CURRENT_SCENE, { currentScene, previousScene })
export type SetCurrentScene = ReturnType<typeof setCurrentScene>

export const SIGNAL_SCENE_READY = 'SIGNAL_SCENE_READY'
/**
 * This action marks a scene "Ready". It is used to start the internal game loop
 * of each scene and to remove the loading screen.
 */
export const signalSceneReady = (sceneId: string, sceneNumber: number) =>
  action(SIGNAL_SCENE_READY, { sceneId, sceneNumber })
export type SignalSceneReady = ReturnType<typeof signalSceneReady>
