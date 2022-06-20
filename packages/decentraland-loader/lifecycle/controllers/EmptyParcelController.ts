import { EntityType, Scene } from '@dcl/schemas'
import { jsonFetch } from 'atomicHelpers/jsonFetch'
import { PREVIEW, rootURLPreviewMode } from 'config'
import { WorldConfig } from 'shared/meta/types'
import { ContentMapping, LoadableScene } from 'shared/types'

export class EmptyParcelController {
  emptyScenesPromise: Promise<Record<string, ContentMapping[]>>
  baseUrl: string = ''

  constructor(
    public options: {
      contentServer: string
      catalystServer: string
      contentServerBundles: string
      worldConfig: WorldConfig
      rootUrl: string
    }
  ) {
    let rootUrl = options.rootUrl

    if (PREVIEW) {
      // rootURLPreviewMode returns rootUrl without ending slash
      rootUrl = rootURLPreviewMode() + '/'
    }

    this.baseUrl = `${rootUrl}loader/empty-scenes/`

    this.emptyScenesPromise = jsonFetch(this.baseUrl + 'mappings.json')
  }

  async createFakeEntity(coordinates: string): Promise<LoadableScene> {
    const emptyScenes = await this.emptyScenesPromise
    const names = Object.keys(emptyScenes)
    const sceneName = names[Math.floor(Math.random() * names.length)]
    const entityId = `Qm${coordinates}m`

    const metadata: Scene = {
      display: { title: 'Empty parcel' },
      contact: { name: 'Decentraland' },
      owner: '',
      main: `bin/game.js`,
      tags: [],
      scene: { parcels: [coordinates], base: coordinates }
    }

    return {
      id: entityId,
      baseUrl: this.baseUrl + 'contents/',
      entity: {
        content: emptyScenes[sceneName]!,
        pointers: [coordinates],
        timestamp: Date.now(),
        type: EntityType.SCENE,
        metadata,
        version: 'v3'
      }
    }
  }
}
