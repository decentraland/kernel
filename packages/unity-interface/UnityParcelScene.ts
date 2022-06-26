import { Vector3 } from '@dcl/ecs-math'

import { gridToWorld } from '../atomicHelpers/parcelScenePositions'
import { createDummyLogger, createLogger } from 'shared/logger'
import { EnvironmentData, LoadableParcelScene, LoadablePortableExperienceScene } from 'shared/types'
import { SceneWorker } from 'shared/world/SceneWorker'
import { UnityScene } from './UnityScene'
import { DEBUG_SCENE_LOG } from 'config'
import { defaultParcelPermissions, defaultPortableExperiencePermissions } from 'shared/apis/host/Permissions'
import { PermissionItem, permissionItemFromJSON } from 'shared/apis/proto/Permissions.gen'

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
    worker.rpcContext.EngineAPI = { parcelSceneAPI: this, subscribedEvents: new Set() }

    worker.rpcContext.sceneData = { ...this.data.data.loadableScene, isPortableExperience: false }

    worker.rpcContext.DevTools.logger = this.logger

    const permissionArray: PermissionItem[] = []

    if (this.data.data.loadableScene.entity.metadata?.requiredPermissions) {
      for (const permissionItemString of this.data.data.loadableScene.entity.metadata?.requiredPermissions) {
        permissionArray.push(permissionItemFromJSON(permissionItemString))
      }
    }

    this.loadPermission(defaultParcelPermissions, permissionArray).catch((err) => {
      this.logger.error(err)
    })
  }
}

export class UnityPortableExperienceScene extends UnityScene<LoadablePortableExperienceScene> {
  constructor(public data: EnvironmentData<LoadablePortableExperienceScene>, public readonly parentCid: string) {
    super(data)
    const loggerPrefix = `px: [${data.id}] `
    this.logger = DEBUG_SCENE_LOG ? createLogger(loggerPrefix) : createDummyLogger()
  }

  registerWorker(worker: SceneWorker): void {
    super.registerWorker(worker)

    const aux: Vector3 = new Vector3()
    gridToWorld(this.data.data.basePosition.x, this.data.data.basePosition.y, aux)
    worker.setPosition(aux)

    worker.rpcContext.EnvironmentAPI.data = this.data
    worker.rpcContext.EngineAPI = { parcelSceneAPI: this, subscribedEvents: new Set() }
    worker.rpcContext.sceneData = { ...this.data.data.loadableScene, isPortableExperience: true }

    worker.rpcContext.DevTools.logger = this.logger

    this.getPxPermission()
      .then((permissions) => {
        this.loadPermission(defaultPortableExperiencePermissions, permissions).catch((err) => {
          this.logger.error(err)
        })
      })
      .catch(this.logger.error)
  }

  private async getPxPermission() {
    const ret: PermissionItem[] = []
    const sceneJsonFile = this.data.entity.content.find((m) => m.file.startsWith('scene.json'))?.hash
    if (sceneJsonFile) {
      try {
        const sceneJsonUrl = new URL(sceneJsonFile, this.data.baseUrl).toString()
        const sceneJsonReq = await fetch(sceneJsonUrl)
        if (sceneJsonReq.ok) {
          const sceneJson = await sceneJsonReq.json()

          if (sceneJson.requiredPermissions) {
            for (const permissionItemString of sceneJson.requiredPermissions) {
              ret.push(permissionItemFromJSON(permissionItemString))
            }
          }
        }
      } catch (err) {}
    }

    return ret
  }
}
