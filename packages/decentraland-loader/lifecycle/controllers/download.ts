import { future, IFuture } from 'fp-future'
import { WorldConfig } from 'shared/meta/types'
import { EntityWithBaseUrl } from '../lib/types'
import { EmptyParcelController } from './EmptyParcelController'

export class SceneDataDownloadManager {
  positionToEntity: Map<string, IFuture<EntityWithBaseUrl | null>> = new Map()
  entityIdToEntity: Map<string, IFuture<EntityWithBaseUrl | null>> = new Map()

  constructor(
    public options: {
      contentServer: string
      catalystServer: string
      contentServerBundles: string
      worldConfig: WorldConfig
      rootUrl: string
      emptyScenes: boolean
      emptyParcelController: EmptyParcelController
    }
  ) {}

  async resolveEntitiesByPosition(tiles: string[]): Promise<Set<EntityWithBaseUrl>> {
    const futures: Promise<EntityWithBaseUrl | null>[] = []

    const missingTiles: string[] = []

    for (const tile of tiles) {
      let promise: IFuture<EntityWithBaseUrl | null>

      if (this.positionToEntity.has(tile)) {
        promise = this.positionToEntity.get(tile)!
      } else {
        promise = future<EntityWithBaseUrl | null>()
        this.positionToEntity.set(tile, promise)
        missingTiles.push(tile)
      }

      futures.push(promise.then((entity) => entity))
    }

    if (missingTiles.length > 0) {
      const activeEntities = this.options.contentServer + '/entities/active'

      const scenesResponse = await fetch(activeEntities, {
        method: 'post',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pointers: missingTiles })
      })

      if (scenesResponse.ok) {
        const entities: EntityWithBaseUrl[] = await scenesResponse.json()
        // resolve promises
        for (const entity of entities) {
          entity.baseUrl = entity.baseUrl || this.options.contentServer + '/contents/'

          for (const tile of entity.pointers) {
            if (this.positionToEntity.has(tile)) {
              const promise = this.positionToEntity.get(tile)
              promise!.resolve(entity)
            } else {
              // if we get back a pointer/tile that was not pending => create the future and resolve
              const promise = future<EntityWithBaseUrl | null>()
              promise.resolve(entity)
              this.positionToEntity.set(tile, promise)
            }
          }

          const pendingSceneData: IFuture<EntityWithBaseUrl | null> = this.entityIdToEntity.get(entity.id) || future()

          if (pendingSceneData.isPending) {
            pendingSceneData.resolve(entity)
          }

          if (!this.entityIdToEntity.has(entity.id)) {
            this.entityIdToEntity.set(entity.id, pendingSceneData)
          }
        }

        // missing tiles will correspond to empty parcels
        for (const tile of missingTiles) {
          const promise = this.positionToEntity.get(tile)
          if (promise?.isPending) {
            if (this.options.emptyScenes) {
              const emptyParcel = await this.options.emptyParcelController.createFakeEntity(tile)
              promise?.resolve(emptyParcel)
            } else {
              promise?.resolve(null)
            }
          }
        }
      }
    }

    const ret = await Promise.all(futures)

    return new Set(ret.filter(Boolean) as EntityWithBaseUrl[])
  }

  async getParcelDataByEntityId(entityId: string): Promise<EntityWithBaseUrl | null> {
    return this.entityIdToEntity.get(entityId)!
  }
}
