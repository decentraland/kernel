import { Vector3 } from '@dcl/ecs-math'

import { gridToWorld } from '../atomicHelpers/parcelScenePositions'
import { createDummyLogger, createLogger } from 'shared/logger'
import { EnvironmentData, LoadableParcelScene, LoadablePortableExperienceScene } from 'shared/types'
import { SceneWorker } from 'shared/world/SceneWorker'
import { UnityScene } from './UnityScene'
import { DEBUG_SCENE_LOG } from 'config'
import { defaultParcelPermissions, defaultPortableExperiencePermissions } from 'shared/apis/host/Permissions'

export class UnityParcelScene extends UnityScene<LoadableParcelScene> {
  constructor(public data: EnvironmentData<LoadableParcelScene>) {
    super(data)
    const loggerPrefix = `scene: [${data.data.basePosition.x}, ${data.data.basePosition.y}]`
    this.logger = DEBUG_SCENE_LOG ? createLogger(loggerPrefix) : createDummyLogger()
  }

  registerWorker(worker: SceneWorker): void {
    super.registerWorker(worker)

    const aux: Vector3 = new Vector3()
    gridToWorld(this.data.data.basePosition.x, this.data.data.basePosition.y, aux)
    worker.setPosition(aux)

    worker.rpcContext.EnvironmentAPI.data = this.data
    worker.rpcContext.EngineAPI = { parcelSceneAPI: this, didStart: false, subscribedEvents: {} }

    worker.rpcContext.ParcelIdentity.land = this.data.data.land!
    worker.rpcContext.ParcelIdentity.cid = worker.getSceneId()
    worker.rpcContext.ParcelIdentity.isPortableExperience = false

    worker.rpcContext.DevTools.logger = this.logger

    this.loadPermission(defaultParcelPermissions).catch((err) => {
      this.logger.error(err)
    })
  }
}

export class UnityPortableExperienceScene extends UnityScene<LoadablePortableExperienceScene> {
  constructor(public data: EnvironmentData<LoadablePortableExperienceScene>, public readonly parentCid: string) {
    super(data)
    const loggerPrefix = `px: [${data.sceneId}] `
    this.logger = DEBUG_SCENE_LOG ? createLogger(loggerPrefix) : createDummyLogger()
  }

  registerWorker(worker: SceneWorker): void {
    super.registerWorker(worker)

    const aux: Vector3 = new Vector3()
    gridToWorld(this.data.data.basePosition.x, this.data.data.basePosition.y, aux)
    worker.setPosition(aux)

    worker.rpcContext.EnvironmentAPI.data = this.data
    worker.rpcContext.EngineAPI = { parcelSceneAPI: this, didStart: false, subscribedEvents: {} }

    worker.rpcContext.ParcelIdentity.cid = worker.getSceneId()
    worker.rpcContext.ParcelIdentity.isPortableExperience = true

    worker.rpcContext.DevTools.logger = this.logger

    this.loadPermission(defaultPortableExperiencePermissions).catch((err) => {
      this.logger.error(err)
    })
  }
}
