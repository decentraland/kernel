import { ILand } from 'shared/types'

export type SceneLifeCycleStatusType = 'unloaded' | 'awake' | 'loaded' | 'ready' | 'failed'

export class SceneLifeCycleStatus {
  status: SceneLifeCycleStatusType = 'unloaded'

  //We could have a scene that is not linked to a land in the builder
  constructor(public sceneDescription: ILand | undefined) {}

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
