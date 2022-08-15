import { SceneLifeCycleStatus, SceneLifeCycleStatusType } from '../lib/scene.status'
import { EventEmitter } from 'events'
import { SceneDataDownloadManager } from './download'
import defaultLogger from 'shared/logger'

export type SceneLifeCycleStatusReport = { entityId: string; status: SceneLifeCycleStatusType }
export type NewDrawingDistanceReport = { distanceInParcels: number }

type EntityId = string

export class SceneLifeCycleController extends EventEmitter {
  private downloadManager: SceneDataDownloadManager
  private sceneStatus = new Map<EntityId, SceneLifeCycleStatus>()

  constructor(opts: { downloadManager: SceneDataDownloadManager }) {
    super()
    this.downloadManager = opts.downloadManager
  }

  async reportSightedParcels(sightedParcels: string[], lostSightParcels: string[]) {
    const sighted = Array.from(await this.downloadManager.resolveEntitiesByPosition(sightedParcels))
    const lostSight = Array.from(await this.downloadManager.resolveEntitiesByPosition(lostSightParcels))

    sighted.forEach((entity) => {
      try {
        if (!this.sceneStatus.has(entity.id)) {
          if (entity) {
            this.sceneStatus.set(entity.id, new SceneLifeCycleStatus(entity))
          }
        }

        if (this.sceneStatus.get(entity.id)!.isDead() && entity) {
          this.sceneStatus.get(entity.id)!.status = 'loaded'
          this.emit('Start scene', entity)
        }
      } catch (e) {
        defaultLogger.error(`error while loading scene ${entity.id}`, e)
      }
    })

    const difference = lostSight.filter((a) => !sighted.some((b) => a.id === b.id))
    this.unloadScenes(difference.map((entity) => entity.id))

    return { sighted: sighted.map((entity) => entity.id), lostSight: difference }
  }

  isRenderable(entityId: EntityId): boolean {
    const status = this.sceneStatus.get(entityId)
    return !!status && (status.isReady() || status.isFailed())
  }

  reportStatus(entityId: string, status: SceneLifeCycleStatusType) {
    const lifeCycleStatus = this.sceneStatus.get(entityId)
    if (!lifeCycleStatus) {
      defaultLogger.info(`no lifecycle status for scene ${entityId}`)
      return
    }
    lifeCycleStatus.status = status

    this.emit('Scene status', { entityId, status })
  }

  isSceneRunning(entityId: string): boolean {
    const lifeCycleStatus = this.sceneStatus.get(entityId)
    if (!lifeCycleStatus) {
      return false
    }
    return lifeCycleStatus.isReady()
  }

  private unloadScenes(entityIds: string[]) {
    entityIds.forEach((entityId) => {
      const sceneStatus = this.sceneStatus.get(entityId)
      if (sceneStatus && sceneStatus.isAwake()) {
        sceneStatus.status = 'unloaded'
        this.emit('Unload scene', entityId)
      }
    })
  }
}
