import { Vector2Component } from 'atomicHelpers/landHelpers'
import { SceneLifeCycleController } from './scene'
import { EventEmitter } from 'events'
import { ParcelLifeCycleController, ParcelSightSeeingReport } from './parcel'
import { SceneDataDownloadManager } from './download'
import { worldToGrid, gridToWorld } from '../../../atomicHelpers/parcelScenePositions'
import { pickWorldSpawnpoint } from 'shared/world/positionThings'
import { InstancedSpawnPoint } from 'shared/types'
import { createLogger } from 'shared/logger'

const DEBUG = false

const logger = createLogger('position: ')
export class PositionLifecycleController extends EventEmitter {
  private positionSettled: boolean = true
  private currentlySightedScenes: string[] = []
  private currentSpawnpoint?: InstancedSpawnPoint
  private currentPosition: Vector2Component | null = null

  constructor(
    private downloadManager: SceneDataDownloadManager,
    private parcelController: ParcelLifeCycleController,
    private sceneController: SceneLifeCycleController
  ) {
    super()
    sceneController.on('Scene status', () => this.checkPositionSettlement())
  }

  async reportCurrentPosition(position: Vector2Component, teleported: boolean) {
    if (
      !this.positionSettled ||
      (this.currentPosition &&
        this.currentPosition.x === position.x &&
        this.currentPosition.y === position.y &&
        !teleported)
    ) {
      return
    }

    // first thing to do in case of teleport -> unsettle position & notify to avoid concurrent updates
    if (teleported) {
      this.positionSettled = false
      this.emit('Unsettled Position')
    }

    let resolvedPosition = position
    this.currentPosition = resolvedPosition

    if (teleported) {
      const lands = await this.downloadManager.resolveEntitiesByPosition([`${position.x},${position.y}`])
      if (lands.size) {
        const [first] = lands
        const spawnPoint = pickWorldSpawnpoint(first.entity.metadata)
        resolvedPosition = worldToGrid(spawnPoint.position)
        this.currentSpawnpoint = spawnPoint
      } else {
        this.currentSpawnpoint = { position: gridToWorld(position.x, position.y) }
      }
    }

    const parcels = this.parcelController.reportCurrentPosition(resolvedPosition)
    await this.updateSightedParcels(parcels)

    this.checkPositionSettlement()
  }

  public async updateSightedParcels(parcels: ParcelSightSeeingReport | undefined) {
    if (parcels === undefined) return

    const newlySightedScenes = await this.sceneController.reportSightedParcels(parcels.sighted, parcels.lostSight)
    if (!eqSet(this.currentlySightedScenes, newlySightedScenes.sighted)) {
      this.currentlySightedScenes = newlySightedScenes.sighted
    }
  }

  private checkPositionSettlement() {
    if (!this.positionSettled) {
      const settling = this.currentlySightedScenes.every(($) => this.sceneController.isRenderable($))

      DEBUG &&
        logger.info(
          `remaining-scenes`,
          this.currentlySightedScenes.filter(($) => !this.sceneController.isRenderable($))
        )
      if (settling) {
        this.positionSettled = settling

        DEBUG && logger.info(`settled-position-triggered`, this.currentPosition)
        this.emit('Settled Position', this.currentSpawnpoint)
      }
    }
  }
}

function eqSet(as: Array<any>, bs: Array<any>) {
  if (as.length !== bs.length) return false
  for (const a of as) if (!bs.includes(a)) return false
  for (const b of bs) if (!as.includes(b)) return false
  return true
}
