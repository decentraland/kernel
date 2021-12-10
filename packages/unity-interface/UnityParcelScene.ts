import { Vector3 } from '@dcl/ecs-math'

import { gridToWorld } from '../atomicHelpers/parcelScenePositions'
import { DevTools } from 'shared/apis/DevTools'
import { ParcelIdentity } from 'shared/apis/ParcelIdentity'
import { createDummyLogger, createLogger } from 'shared/logger'
import { EnvironmentData, LoadableParcelScene, LoadablePortableExperienceScene } from 'shared/types'
import { SceneWorker } from 'shared/world/SceneWorker'
import { Permissions, defaultPortableExperiencePermissions } from 'shared/apis/Permissions'
import { UnityScene } from './UnityScene'
import { DEBUG_SCENE_LOG } from 'config'
export class UnityParcelScene extends UnityScene<LoadableParcelScene> {
  constructor(public data: EnvironmentData<LoadableParcelScene>) {
    super(data)
    let loggerPrefix = data.data.basePosition.x + ',' + data.data.basePosition.y + ': '
    this.logger = DEBUG_SCENE_LOG ? createLogger(loggerPrefix) : createDummyLogger()
  }

  registerWorker(worker: SceneWorker): void {
    super.registerWorker(worker)

    let aux: Vector3 = new Vector3()
    gridToWorld(this.data.data.basePosition.x, this.data.data.basePosition.y, aux)
    worker.setPosition(aux)

    this.worker
      .getAPIInstance(DevTools)
      .then((devTools) => (devTools.logger = this.logger))
      .catch((e) => this.logger.error('Error initializing system DevTools', e))

    this.worker
      .getAPIInstance(ParcelIdentity)
      .then((parcelIdentity) => {
        parcelIdentity.land = this.data.data.land!
        parcelIdentity.cid = worker.getSceneId()
        parcelIdentity.isPortableExperience = false
      })
      .catch((e) => this.logger.error('Error initializing system ParcelIdentity', e))
  }
}

export class UnityPortableExperienceScene extends UnityScene<LoadablePortableExperienceScene> {
  constructor(public data: EnvironmentData<LoadablePortableExperienceScene>) {
    super(data)
    let loggerPrefix = data.sceneId + ': '
    this.logger = DEBUG_SCENE_LOG ? createLogger(loggerPrefix) : createDummyLogger()
  }

  registerWorker(worker: SceneWorker): void {
    super.registerWorker(worker)

    let aux: Vector3 = new Vector3()
    gridToWorld(this.data.data.basePosition.x, this.data.data.basePosition.y, aux)
    worker.setPosition(aux)

    this.worker
      .getAPIInstance(DevTools)
      .then((devTools) => (devTools.logger = this.logger))
      .catch((e) => this.logger.error('Error initializing system DevTools', e))

    this.worker
      .getAPIInstance(ParcelIdentity)
      .then((parcelIdentity) => {
        parcelIdentity.cid = worker.getSceneId()
        parcelIdentity.isPortableExperience = true
      })
      .catch((e) => this.logger.error('Error initializing system ParcelIdentity', e))

    this.worker.getAPIInstance(Permissions).then((permissions) => {
      permissions.permissionGranted = defaultPortableExperiencePermissions
    })
      .catch((e) => this.logger.error('Error initializing system Permissions', e))
  }
}
