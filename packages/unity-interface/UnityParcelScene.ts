import { Vector3 } from '@dcl/ecs-math'

import { gridToWorld } from '../atomicHelpers/parcelScenePositions'
// import { DevTools } from 'shared/apis/DevTools'
// import { ParcelIdentity } from 'shared/apis/ParcelIdentity'
import { createDummyLogger, createLogger } from 'shared/logger'
import { EnvironmentData, LoadableParcelScene, LoadablePortableExperienceScene } from 'shared/types'
import { SceneWorker } from 'shared/world/SceneWorker'
import { UnityScene } from './UnityScene'
import { DEBUG_SCENE_LOG } from 'config'
// import { defaultPortableExperiencePermissions, Permissions } from 'shared/apis/Permissions'
// import { PermissionItem } from 'shared/apis/PermissionItems'

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

    worker.patchContext({
      EnvironmentAPI: { data: this.data },
      EngineAPI: { parcelSceneAPI: this, didStart: false, subscribedEvents: {} }
    })
    // this.worker
    //   .getAPIInstance(DevTools)
    //   .then((devTools) => (devTools.logger = this.logger))
    //   .catch((e) => this.logger.error('Error initializing system DevTools', e))
    // this.worker
    //   .getAPIInstance(ParcelIdentity)
    //   .then((parcelIdentity) => {
    //     parcelIdentity.land = this.data.data.land!
    //     parcelIdentity.cid = worker.getSceneId()
    //     parcelIdentity.isPortableExperience = false
    //   })
    //   .catch((e) => this.logger.error('Error initializing system ParcelIdentity', e))
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

    // TODO: load new rpc data

    // this.worker
    //   .getAPIInstance(DevTools)
    //   .then((devTools) => (devTools.logger = this.logger))
    //   .catch((e) => this.logger.error('Error initializing system DevTools', e))

    // this.worker
    //   .getAPIInstance(ParcelIdentity)
    //   .then((parcelIdentity) => {
    //     parcelIdentity.cid = worker.getSceneId()
    //     parcelIdentity.isPortableExperience = true
    //   })
    //   .catch((e) => this.logger.error('Error initializing system ParcelIdentity', e))

    // this.worker
    //   .getAPIInstance(Permissions)
    //   .then(async (permissions) => {
    //     const permissionArray: PermissionItem[] = [...defaultPortableExperiencePermissions]
    //     const sceneJsonFile = this.data.mappings.find((m) => m.file.startsWith('scene.json'))?.hash

    //     if (sceneJsonFile) {
    //       const sceneJson = await (await fetch(new URL(sceneJsonFile, this.data.baseUrl).toString())).json()
    //       permissionArray.push(
    //         ...Object.values(PermissionItem).filter((permission) => sceneJson.requiredPermissions?.includes(permission))
    //       )
    //     }

    //     // Delete duplicated
    //     const permissionSet = new Set<PermissionItem>(permissionArray)
    //     permissions.forcePermissions(Array.from(permissionSet))
    //   })
    //   .catch((e) => this.logger.error('Error initializing system Permissions', e))
  }
}
