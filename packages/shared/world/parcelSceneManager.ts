/* eslint-disable prefer-const */
import {
  initParcelSceneWorker,
  LifecycleManager,
  ParcelSceneLoadingParams
} from 'decentraland-loader/lifecycle/manager'
import {
  NewDrawingDistanceReport,
  SceneLifeCycleStatusReport
} from '../../decentraland-loader/lifecycle/controllers/scene'
import { scenesChanged, SCENE_FAIL, SCENE_LOAD, SCENE_START } from '../loading/actions'
import { InstancedSpawnPoint, LoadableScene } from '../types'
import { parcelObservable, teleportObservable } from './positionThings'
import { SceneWorker, workerStatusObservable } from './SceneWorker'
import { store } from 'shared/store/isolatedStore'
import { Observable } from 'mz-observable'
import { ParcelSceneLoadingState } from './types'
import { getFeatureFlagVariantValue } from 'shared/meta/selectors'
import { signalParcelLoadingStarted } from 'shared/renderer/actions'
import { Transport } from '@dcl/rpc'
import { defaultParcelPermissions } from 'shared/apis/host/Permissions'
import { SceneLifeCycleStatusType } from 'decentraland-loader/lifecycle/lib/scene.status'

export type EnableParcelSceneLoadingOptions = {
  parcelSceneClass: {
    new (x: LoadableScene): SceneWorker
  }
  onPositionSettled?: (spawnPoint: InstancedSpawnPoint) => void
  onPositionUnsettled?(): void
}

declare const globalThis: any

const PARCEL_DENY_LISTED_FEATURE_FLAG = 'parcel-denylist'
export function isParcelDenyListed(coordinates: string[]) {
  const denylist = getFeatureFlagVariantValue(store.getState(), PARCEL_DENY_LISTED_FEATURE_FLAG) as string

  const setOfCoordinates = new Set(coordinates)

  if (denylist) {
    return denylist.split(/[\s\r\n]+/gm).some(($) => setOfCoordinates.has($.trim()))
  }

  return false
}

export function generateBannedLoadableScene(entity: LoadableScene): LoadableScene {
  return {
    ...entity,
    entity: {
      ...entity.entity,
      content: []
    }
  }
}

export const renderDistanceObservable = new Observable<Readonly<NewDrawingDistanceReport>>()
export const onLoadParcelScenesObservable = new Observable<SceneWorker>()
/**
 * Array of sceneId's
 */
export const onPositionSettledObservable = new Observable<InstancedSpawnPoint>()
export const onPositionUnsettledObservable = new Observable()

export const loadedSceneWorkers = new Map<string, SceneWorker>()
globalThis['sceneWorkers'] = loadedSceneWorkers

/**
 * Retrieve the Scene based on it's ID, usually RootCID
 */
export function getSceneWorkerBySceneID(sceneId: string) {
  return loadedSceneWorkers.get(sceneId)
}

export function forceStopScene(sceneId: string) {
  const worker = loadedSceneWorkers.get(sceneId)
  if (worker) {
    worker.dispose()
    loadedSceneWorkers.delete(sceneId)
    store.dispatch(scenesChanged())
  }
}

/**
 * Creates a worker for the ParcelSceneAPI
 */
export function loadParcelSceneWorker(loadableScene: LoadableScene, transport?: Transport) {
  const sceneId = loadableScene.id
  let parcelSceneWorker = loadedSceneWorkers.get(sceneId)

  if (!parcelSceneWorker) {
    parcelSceneWorker = new SceneWorker(loadableScene, transport)
    setNewParcelScene(parcelSceneWorker)
    queueMicrotask(() => store.dispatch(scenesChanged()))
  }

  return parcelSceneWorker
}

/**
 * idempotent
 */
function setNewParcelScene(worker: SceneWorker) {
  const sceneId = worker.loadableScene.id
  const parcelSceneWorker = loadedSceneWorkers.get(worker.loadableScene.id)

  if (worker === parcelSceneWorker) return

  if (parcelSceneWorker) {
    // stop the current scene, forcing a reload
    forceStopScene(sceneId)
  }

  loadedSceneWorkers.set(sceneId, worker)
}

// @internal
export const parcelSceneLoadingState: ParcelSceneLoadingState = {
  isWorldLoadingEnabled: true,
  desiredParcelScenes: new Map(),
  lifecycleManager: null as any as LifecycleManager
}

/**
 *  @internal
 * Returns a set of Set<SceneId>
 */
export function getDesiredParcelScenes(): Map<string, LoadableScene> {
  return new Map(parcelSceneLoadingState.desiredParcelScenes)
}

/**
 * @internal
 * Receives a set of Set<SceneId>
 */
async function setDesiredParcelScenes(desiredParcelScenes: Map<string, LoadableScene>) {
  const previousSet = new Set(parcelSceneLoadingState.desiredParcelScenes)
  const newSet = (parcelSceneLoadingState.desiredParcelScenes = desiredParcelScenes)

  // react to changes
  for (const [oldSceneId] of previousSet) {
    if (!newSet.has(oldSceneId) && loadedSceneWorkers.has(oldSceneId)) {
      // destroy old scene
      unloadParcelSceneById(oldSceneId)
    }
  }

  for (const [newSceneId, entity] of newSet) {
    if (!loadedSceneWorkers.has(newSceneId)) {
      // create new scene
      await loadParcelSceneByIdIfMissing(newSceneId, entity)
    }
  }
}

export async function reloadScene(sceneId: string) {
  unloadParcelSceneById(sceneId)
  await setDesiredParcelScenes(getDesiredParcelScenes())
}

export function unloadParcelSceneById(sceneId: string) {
  const worker = loadedSceneWorkers.get(sceneId)
  if (!worker) {
    return
  }
  //We notify that the scene has been unloaded, the sceneId must have the same name
  parcelSceneLoadingState.lifecycleManager?.notify('Scene.status', {
    sceneId: sceneId,
    status: 'unloaded'
  })
  forceStopScene(sceneId)
}

/**
 * @internal
 **/
export async function loadParcelSceneByIdIfMissing(sceneId: string, entity: LoadableScene) {
  // create the worker if don't exis
  if (!getSceneWorkerBySceneID(sceneId)) {
    // If we are running in isolated mode and it is builder mode, we create a stateless worker instead of a normal worker
    const denyListed = isParcelDenyListed(entity.entity.metadata.scene.parcels)
    const usedEntity = denyListed ? generateBannedLoadableScene(entity) : entity

    const worker = loadParcelSceneWorker(usedEntity)

    // add default permissions for Parcel based scenes
    defaultParcelPermissions.forEach(($) => worker.rpcContext.permissionGranted.add($))
    // and enablle FPS throttling, it will lower the frame-rate based on the distance
    worker.rpcContext.sceneData.useFPSThrottling = true

    setNewParcelScene(worker)

    onLoadParcelScenesObservable.notifyObservers(worker)
  }
}

async function removeDesiredParcel(sceneId: string) {
  const desiredScenes = getDesiredParcelScenes()
  if (!hasDesiredParcelScenes(sceneId)) return
  desiredScenes.delete(sceneId)
  await setDesiredParcelScenes(desiredScenes)
}

export async function addDesiredParcel(entity: LoadableScene) {
  const desiredScenes = getDesiredParcelScenes()
  if (hasDesiredParcelScenes(entity.id)) return
  desiredScenes.set(entity.id, entity)
  await setDesiredParcelScenes(desiredScenes)
}

function hasDesiredParcelScenes(sceneId: string): boolean {
  return parcelSceneLoadingState.desiredParcelScenes.has(sceneId)
}

export async function enableParcelSceneLoading(params: ParcelSceneLoadingParams) {
  const lifecycleManager = await initParcelSceneWorker(params)

  parcelSceneLoadingState.lifecycleManager = lifecycleManager

  lifecycleManager.on('Scene.shouldStart', async (opts: { entity: LoadableScene }) => {
    await addDesiredParcel(opts.entity)
  })

  lifecycleManager.on('Scene.shouldUnload', async (opts: { sceneId: string }) => {
    await removeDesiredParcel(opts.sceneId)
  })

  lifecycleManager.on('Position.settled', async (opts: { spawnPoint: InstancedSpawnPoint }) => {
    onPositionSettledObservable.notifyObservers(opts.spawnPoint)
  })

  lifecycleManager.on('Position.unsettled', () => {
    onPositionUnsettledObservable.notifyObservers({})
  })

  teleportObservable.add((position: { x: number; y: number }) => {
    lifecycleManager.notify('User.setPosition', { position, teleported: true })
  })

  renderDistanceObservable.add((event) => {
    lifecycleManager.notify('SetScenesLoadRadius', event)
  })

  workerStatusObservable.add((action) => {
    let status: SceneLifeCycleStatusType = 'failed'

    switch (action.type) {
      case SCENE_FAIL: {
        status = 'failed'
        break
      }
      case SCENE_LOAD: {
        status = 'loaded'
        break
      }
      case SCENE_START: {
        status = 'ready'
        break
      }
    }

    const sceneStatus: SceneLifeCycleStatusReport = {
      sceneId: action.payload.id,
      status
    }

    lifecycleManager.notify('Scene.status', sceneStatus)
  })

  parcelObservable.add((obj) => {
    // immediate reposition should only be broadcasted to others, otherwise our scene reloads
    if (obj.immediate) return

    // If we are in isolated mode we don't report the position
    lifecycleManager.notify('User.setPosition', {
      position: obj.newParcel,
      teleported: false
    })
  })

  store.dispatch(signalParcelLoadingStarted())
}

export type AllScenesEvents<T extends IEventNames> = {
  eventType: T
  payload: IEvents[T]
}

export function allScenesEvent<T extends IEventNames>(data: AllScenesEvents<T>) {
  for (const [, scene] of loadedSceneWorkers) {
    scene.rpcContext.sendSceneEvent(data.eventType, data.payload)
  }
}
