import { scenesChanged } from '../loading/actions'
import { InstancedSpawnPoint, LoadableScene } from '../types'
import { SceneWorker } from './SceneWorker'
import { store } from 'shared/store/isolatedStore'
import { Observable } from 'mz-observable'
import { ParcelSceneLoadingState } from './types'
import { getFeatureFlagVariantValue } from 'shared/meta/selectors'
import { Transport } from '@dcl/rpc'
import { defaultParcelPermissions } from 'shared/apis/host/Permissions'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { loadableSceneToLoadableParcelScene } from 'shared/selectors'

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

export const onLoadParcelScenesObservable = new Observable<LoadableScene[]>()
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
  desiredParcelScenes: new Map()
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
  forceStopScene(sceneId)
}

/**
 * @internal
 **/
async function loadParcelSceneByIdIfMissing(sceneId: string, entity: LoadableScene) {
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

      // ensure that the scenes will load when workers are created.
    getUnityInstance().LoadParcelScenes([loadableSceneToLoadableParcelScene(entity)])
  }
}

export async function removeDesiredParcel(sceneId: string) {
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

export type AllScenesEvents<T extends IEventNames> = {
  eventType: T
  payload: IEvents[T]
}

export function allScenesEvent<T extends IEventNames>(data: AllScenesEvents<T>) {
  for (const [, scene] of loadedSceneWorkers) {
    scene.rpcContext.sendSceneEvent(data.eventType, data.payload)
  }
}
