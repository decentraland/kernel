import { Entity } from '@dcl/schemas'
import { future, IFuture } from 'fp-future'
import { WorldConfig } from 'shared/meta/types'
import { LoadableScene } from 'shared/types'
import { EmptyParcelController } from './EmptyParcelController'

export class SceneDataDownloadManager {
  positionToEntity: Map<string, IFuture<LoadableScene | null>> = new Map()
  entityIdToEntity: Map<string, IFuture<LoadableScene | null>> = new Map()

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

  async resolveEntitiesByPosition(tiles: string[]): Promise<Set<LoadableScene>> {
    const futures: Promise<LoadableScene | null>[] = []

    const missingTiles: string[] = []

    for (const tile of tiles) {
      let promise: IFuture<LoadableScene | null>

      if (this.positionToEntity.has(tile)) {
        promise = this.positionToEntity.get(tile)!
      } else {
        promise = future<LoadableScene | null>()
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
        const entities: Entity[] = await scenesResponse.json()
        // resolve promises
        for (const entity of entities) {
          const entityWithBaseUrl: LoadableScene = {
            id: entity.id,
            baseUrl: (entity as any).baseUrl || this.options.contentServer + '/contents/',
            entity
          }
          for (const tile of entity.pointers) {
            if (this.positionToEntity.has(tile)) {
              const promise = this.positionToEntity.get(tile)
              promise!.resolve(entityWithBaseUrl)
            } else {
              // if we get back a pointer/tile that was not pending => create the future and resolve
              const promise = future<LoadableScene | null>()
              promise.resolve(entityWithBaseUrl)
              this.positionToEntity.set(tile, promise)
            }
          }

          const pendingSceneData: IFuture<LoadableScene | null> = this.entityIdToEntity.get(entity.id) || future()

          if (pendingSceneData.isPending) {
            pendingSceneData.resolve(entityWithBaseUrl)
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

    return new Set(ret.filter(Boolean) as LoadableScene[])
  }

  async getParcelDataByEntityId(entityId: string): Promise<LoadableScene | null> {
    return this.entityIdToEntity.get(entityId)!
  }
}
