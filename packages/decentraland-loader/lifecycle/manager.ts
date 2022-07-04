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

/*
 * The worker is set up on the first require of this file
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lifecycleWorkerRaw = require('raw-loader!../../../static/loader/worker.js')
const lifecycleWorkerUrl = URL.createObjectURL(new Blob([lifecycleWorkerRaw]))
const worker: Worker = new Worker(lifecycleWorkerUrl, { name: 'LifecycleWorker' })
worker.onerror = (e) => defaultLogger.error('Loader worker error', e)

export class LifecycleManager extends TransportBasedServer {
  sceneIdToRequest: Map<string, IFuture<LoadableScene>> = new Map()
  positionToRequest: Map<string, IFuture<string>> = new Map()

  enable() {
    super.enable()
    this.on('Scene.dataResponse', (scene: { data: LoadableScene }) => {
      if (scene.data) {
        const future = this.sceneIdToRequest.get(scene.data.id)

        if (future) {
          future.resolve(scene.data)
        }
      }
    })

    this.on('Scene.idResponse', (scene: { position: string; data: string }) => {
      const future = this.positionToRequest.get(scene.position)

      if (future) {
        future.resolve(scene.data)
      }
    })
  }

  getParcelData(sceneId: string): Promise<LoadableScene> {
    let theFuture = this.sceneIdToRequest.get(sceneId)
    if (!theFuture) {
      theFuture = future<LoadableScene>()
      this.sceneIdToRequest.set(sceneId, theFuture)
      this.notify('Scene.dataRequest', { sceneId })
    }
    return theFuture
  }

  getSceneIds(parcels: string[]): Promise<string | null>[] {
    const futures: IFuture<string>[] = []
    const missing: string[] = []

    for (const parcel of parcels) {
      let theFuture = this.positionToRequest.get(parcel)

      if (!theFuture) {
        theFuture = future<string>()
        this.positionToRequest.set(parcel, theFuture)

        missing.push(parcel)
      }

      futures.push(theFuture)
    }

    this.notify('Scene.idRequest', { sceneIds: missing })
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
