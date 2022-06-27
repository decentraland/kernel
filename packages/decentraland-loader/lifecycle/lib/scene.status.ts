import { LoadableScene } from 'shared/types'

export type SceneLifeCycleStatusType = 'unloaded' | 'awake' | 'loaded' | 'ready' | 'failed'

export class SceneLifeCycleStatus {
  status: SceneLifeCycleStatusType = 'unloaded'

  constructor(public sceneDescription: LoadableScene) {}

  isAwake() {
    return this.status !== 'unloaded'
  }

  isDead() {
    return this.status === 'unloaded'
  }

  isReady() {
    return this.status === 'ready'
  }

  isFailed() {
    return this.status === 'failed'
  }
}
