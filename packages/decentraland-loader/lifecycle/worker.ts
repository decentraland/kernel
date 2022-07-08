// Entry point for the Lifecycle Worker.
// This doesn't execute on the main thread, so it's a "server" in terms of decentraland-rpc

import { WebWorkerTransport } from 'decentraland-rpc'

import defaultLogger from 'shared/logger'
import { WorldConfig } from 'shared/meta/types'
import { InstancedSpawnPoint, LoadableScene } from 'shared/types'
import { SceneDataDownloadManager } from './controllers/download'
import { EmptyParcelController } from './controllers/EmptyParcelController'
import { ParcelLifeCycleController } from './controllers/parcel'
import { PositionLifecycleController } from './controllers/position'
import { NewDrawingDistanceReport, SceneLifeCycleController, SceneLifeCycleStatusReport } from './controllers/scene'
import { Adapter } from './lib/adapter'

const connector = new Adapter(WebWorkerTransport(self as any))

let parcelController: ParcelLifeCycleController
let sceneController: SceneLifeCycleController
let positionController: PositionLifecycleController
let downloadManager: SceneDataDownloadManager
let emptyParcelController: EmptyParcelController

/**
 * Hook all the events to the connector.
 *
 * Make sure the main thread watches for:
 * - 'Position.settled'
 * - 'Position.unsettled'
 * - 'Scene.shouldStart' (entity: Entity)
 * - 'Scene.shouldUnload' (sceneId: string)
 *
 * Make sure the main thread reports:
 * - 'User.setPosition' { position: {x: number, y: number } }
 */
{
  connector.on(
    'Lifecycle.initialize',
    (options: {
      contentServer: string
      catalystServer: string
      contentServerBundles: string
      rootUrl: string
      lineOfSightRadius: number
      emptyScenes: boolean
      worldConfig: WorldConfig
    }) => {
      emptyParcelController = new EmptyParcelController(options)
      downloadManager = new SceneDataDownloadManager({ ...options, emptyParcelController })
      parcelController = new ParcelLifeCycleController(options)
      sceneController = new SceneLifeCycleController({ downloadManager })
      positionController = new PositionLifecycleController(downloadManager, parcelController, sceneController)
      parcelController.on('Sighted', (parcels: string[]) =>
        connector.notify('Parcel.sighted', {
          parcels
        })
      )
      parcelController.on('Lost sight', (parcels: string[]) =>
        connector.notify('Parcel.lostSight', {
          parcels
        })
      )

      positionController.on('Settled Position', (spawnPoint: InstancedSpawnPoint) => {
        connector.notify('Position.settled', { spawnPoint })
      })
      positionController.on('Unsettled Position', () => {
        connector.notify('Position.unsettled')
      })
      sceneController.on('Start scene', (entity) => {
        connector.notify('Scene.shouldStart', { entity })
      })
      sceneController.on('Unload scene', (sceneId) => {
        connector.notify('Scene.shouldUnload', { sceneId })
      })

      connector.on('User.setPosition', (opt: { position: { x: number; y: number }; teleported: boolean }) => {
        positionController.reportCurrentPosition(opt.position, opt.teleported).catch((e) => {
          defaultLogger.error(`error while resolving new scenes around`, e)
        })
      })

      function sendData(sceneId: string, scene: LoadableScene | null) {
        connector.notify('Scene.dataResponse', {
          sceneId: sceneId,
          data: scene
        })
      }

      connector.on('Scene.dataRequest', async (data: { sceneId: string }) => {
        sendData(data.sceneId, await downloadManager.getParcelDataByEntityId(data.sceneId))
      })

      connector.on('Scene.getByPosition', async (data: { positions: string[] }) => {
        const scenes = await downloadManager.resolveEntitiesByPosition(data.positions)

        for (const scene of scenes) {
          sendData(scene.id, scene)
        }
      })

      connector.on('Scene.status', (data: SceneLifeCycleStatusReport) => {
        sceneController.reportStatus(data.sceneId, data.status)
      })

      connector.on('SetScenesLoadRadius', (data: NewDrawingDistanceReport) => {
        const parcels = parcelController.setLineOfSightRadius(data.distanceInParcels)
        void positionController.updateSightedParcels(parcels)
      })
    }
  )
}
