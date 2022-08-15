// This gets executed from the main thread and serves as an interface
// to communicate with the Lifecycle worker, so it's a "Server" in terms of decentraland-rpc

import future, { IFuture } from 'fp-future'
import { TransportBasedServer } from 'decentraland-rpc/lib/host/TransportBasedServer'
import { WebWorkerTransport } from 'decentraland-rpc/lib/common/transports/WebWorker'
import { ensureMetaConfigurationInitialized } from 'shared/meta'
import { getResourcesURL } from 'shared/location'
import { parcelLimits, ENABLE_EMPTY_SCENES, LOS } from 'config'
import defaultLogger from 'shared/logger'
import { WorldConfig } from 'shared/meta/types'
import { LoadableScene } from 'shared/types'
import { Scene } from '@dcl/schemas'

/*
 * The worker is set up on the first require of this file
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lifecycleWorkerRaw = require('raw-loader!../../../static/loader/worker.js')
const lifecycleWorkerUrl = URL.createObjectURL(new Blob([lifecycleWorkerRaw]))
const worker: Worker = new Worker(lifecycleWorkerUrl, { name: 'LifecycleWorker' })
worker.onerror = (e) => defaultLogger.error('Loader worker error', e)

export class LifecycleManager extends TransportBasedServer {
  entityIdToRequest: Map<string, IFuture<LoadableScene | null>> = new Map()
  positionToRequest: Map<string, IFuture<LoadableScene | null>> = new Map()

  enable() {
    super.enable()
    this.on('Scene.dataResponse', (result: { entityId: string; data: LoadableScene | null }) => {
      const future = this.entityIdToRequest.get(result.entityId)

      if (future) {
        future.resolve(result.data)
      }

      if (result.data) {
        const scene: Scene = result.data.entity.metadata
        for (const position of scene.scene.parcels) {
          if (this.positionToRequest.get(position)?.isPending) {
            this.positionToRequest.get(position)!.resolve(result.data)
          }
        }
      }
    })
  }

  getLoadableSceneBySceneId(entityId: string): Promise<LoadableScene | null> {
    let theFuture = this.entityIdToRequest.get(entityId)
    if (!theFuture) {
      theFuture = future<LoadableScene | null>()
      this.entityIdToRequest.set(entityId, theFuture)
      this.notify('Scene.dataRequest', { entityId })
    }
    return theFuture
  }

  getLoadableScenesByPosition(positions: string[]): Promise<LoadableScene | null>[] {
    const futures: IFuture<LoadableScene | null>[] = []
    const missing: string[] = []

    for (const position of positions) {
      let theFuture = this.positionToRequest.get(position)

      if (!theFuture || !theFuture.isPending) {
        theFuture = future<LoadableScene | null>()
        this.positionToRequest.set(position, theFuture)

        missing.push(position)
      }

      futures.push(theFuture)
    }

    this.notify('Scene.getByPosition', { positions: missing })
    return futures
  }
}

let server: LifecycleManager
export const getServer = (): LifecycleManager | void => server

export type ParcelSceneLoadingParams = {
  contentServer: string
  catalystServer: string
  contentServerBundles: string
  worldConfig: WorldConfig
}

export async function initParcelSceneWorker(config: ParcelSceneLoadingParams) {
  await ensureMetaConfigurationInitialized()

  server = new LifecycleManager(WebWorkerTransport(worker))

  server.enable()

  const fullRootUrl = getResourcesURL('.')

  server.notify('Lifecycle.initialize', {
    ...config,
    rootUrl: fullRootUrl,
    lineOfSightRadius: LOS ? Number.parseInt(LOS, 10) : parcelLimits.visibleRadius,
    emptyScenes: ENABLE_EMPTY_SCENES && !(globalThis as any)['isRunningTests']
  })

  return server
}
