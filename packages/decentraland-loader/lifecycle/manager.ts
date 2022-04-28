// This gets executed from the main thread and serves as an interface
// to communicate with the Lifecycle worker, so it's a "Server" in terms of decentraland-rpc

import future, { IFuture } from 'fp-future'

import { TransportBasedServer } from 'decentraland-rpc/lib/host/TransportBasedServer'
import { WebWorkerTransport } from 'decentraland-rpc/lib/common/transports/WebWorker'

import { ensureMetaConfigurationInitialized } from 'shared/meta'
import { getResourcesURL } from 'shared/location'

import { parcelLimits, ENABLE_EMPTY_SCENES, LOS } from 'config'

import { ILand } from 'shared/types'
import defaultLogger from 'shared/logger'
import { WorldConfig } from 'shared/meta/types'

declare const globalThis: { workerManager: LifecycleManager }

/*
 * The worker is set up on the first require of this file
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lifecycleWorkerRaw = require('raw-loader!../../../static/loader/worker.js')
const lifecycleWorkerUrl = URL.createObjectURL(new Blob([lifecycleWorkerRaw]))
const worker: Worker = new Worker(lifecycleWorkerUrl, { name: 'LifecycleWorker' })
worker.onerror = (e) => defaultLogger.error('Loader worker error', e)

export class LifecycleManager extends TransportBasedServer {
  sceneIdToRequest: Map<string, IFuture<ILand>> = new Map()
  positionToRequest: Map<string, IFuture<string>> = new Map()

  enable() {
    super.enable()
    this.on('Scene.dataResponse', (scene: { data: ILand }) => {
      if (scene.data) {
        const future = this.sceneIdToRequest.get(scene.data.sceneId)

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

  setParcelData(sceneId: string, sceneData: ILand) {
    let theFuture = this.sceneIdToRequest.get(sceneId)
    if (!theFuture) {
      theFuture = future<ILand>()
    }
    theFuture.resolve(sceneData)

    this.sceneIdToRequest.set(sceneId, theFuture)
  }

  getParcelData(sceneId: string): Promise<ILand> {
    let theFuture = this.sceneIdToRequest.get(sceneId)
    if (!theFuture) {
      theFuture = future<ILand>()
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

  async reloadScene(sceneId: string) {
    const landFuture = this.sceneIdToRequest.get(sceneId)
    if (landFuture) {
      const land = await landFuture
      const parcels = land.sceneJsonData.scene.parcels
      for (const parcel of parcels) {
        this.positionToRequest.delete(parcel)
      }
      this.notify('Scene.reload', { sceneId })
    }
  }

  async invalidateAllScenes(coordsToInvalidate: string[] | undefined) {
    for (const sceneId of this.sceneIdToRequest.keys()) {
      await this.invalidateSceneAndCoords(sceneId)
    }
    if (coordsToInvalidate) this.notify('Parcel.Invalidate', { coords: coordsToInvalidate })
  }

  invalidateCoords(coords: string[]) {
    for (const coord of coords) {
      this.positionToRequest.delete(coord)
    }
    this.notify('Parcel.Invalidate', { coords })
  }

  async invalidateScene(sceneId: string) {
    this.notify('Scene.Invalidate', { sceneId })
  }

  async invalidateSceneAndCoords(sceneId: string) {
    const landFuture = this.sceneIdToRequest.get(sceneId)
    if (landFuture) {
      const land = await landFuture
      const parcels = land.sceneJsonData.scene.parcels
      for (const parcel of parcels) {
        this.positionToRequest.delete(parcel)
      }
      this.notify('Scene.Invalidate', { sceneId })
    }
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

  globalThis.workerManager = server

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
