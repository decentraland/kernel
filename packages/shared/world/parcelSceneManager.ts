/* eslint-disable prefer-const */
import {
  initParcelSceneWorker,
  LifecycleManager,
  ParcelSceneLoadingParams
} from 'decentraland-loader/lifecycle/manager'
import {
  sceneLifeCycleObservable,
  renderDistanceObservable,
} from '../../decentraland-loader/lifecycle/controllers/scene'
import { scenesChanged, signalSceneFail, signalSceneLoad, signalSceneStart } from '../loading/actions'
import { EnvironmentData, ILand, InstancedSpawnPoint, LoadableParcelScene, LoadableScene } from '../types'
import { ParcelSceneAPI } from './ParcelSceneAPI'
import { parcelObservable, teleportObservable } from './positionThings'
import { SceneWorker, SceneWorkerReadyState } from './SceneWorker'
import { SceneSystemWorker } from './SceneSystemWorker'
import { loadableSceneToLoadableParcelScene } from 'shared/selectors'
import { store } from 'shared/store/isolatedStore'
import { Observable } from '@dcl/legacy-ecs'
import { ParcelSceneLoadingState } from './types'
import { UnityParcelScene } from 'unity-interface/UnityParcelScene'
import { getFeatureFlagVariantValue } from 'shared/meta/selectors'
import { signalParcelLoadingStarted } from 'shared/renderer/actions'
import { Transport } from '@dcl/rpc'

export type EnableParcelSceneLoadingOptions = {
  parcelSceneClass: {
    new (x: EnvironmentData<LoadableParcelScene>): ParcelSceneAPI
  }
  preloadScene: (parcelToLoad: ILand) => Promise<any>
  onPositionSettled?: (spawnPoint: InstancedSpawnPoint) => void
  onLoadParcelScenes?(x: ILand[]): void
  onUnloadParcelScenes?(x: ILand[]): void
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

export function generateBannedILand(entity: LoadableScene): LoadableScene {
  return {
    ...entity,
    entity: {
      ...entity.entity,
      content: []
    }
  }
}

export const onLoadParcelScenesObservable = new Observable<LoadableScene[]>()
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

/** Stops non-persistent scenes (i.e UI scene) */
function stopParcelSceneWorker(worker: SceneWorker) {
  if (worker && !worker.isPersistent()) {
    forceStopSceneWorker(worker)
  }
}

export function forceStopSceneWorker(worker: SceneWorker) {
  const sceneId = worker.getSceneId()
  worker.dispose()
  loadedSceneWorkers.delete(sceneId)
  store.dispatch(scenesChanged())
}

/**
 * Creates a worker for the ParcelSceneAPI
 */
export function loadParcelScene(parcelScene: ParcelSceneAPI, transport?: Transport, persistent: boolean = false) {
  const sceneId = parcelScene.getSceneId()
  let parcelSceneWorker = loadedSceneWorkers.get(sceneId)

  if (!parcelSceneWorker) {
    parcelSceneWorker = new SceneSystemWorker(parcelScene, transport, persistent)
    setNewParcelScene(sceneId, parcelSceneWorker)
  }

  return parcelSceneWorker
}

/**
 * idempotent
 */
function setNewParcelScene(sceneId: string, worker: SceneWorker) {
  const parcelSceneWorker = loadedSceneWorkers.get(sceneId)

  if (worker === parcelSceneWorker) return

  if (parcelSceneWorker) {
    forceStopSceneWorker(parcelSceneWorker)
  }

  loadedSceneWorkers.set(sceneId, worker)
}

function globalSignalSceneLoad(entity: LoadableScene) {
  store.dispatch(signalSceneLoad(entity))
}

function globalSignalSceneStart(entity: LoadableScene) {
  store.dispatch(signalSceneStart(entity))
}

function globalSignalSceneFail(entity: LoadableScene) {
  store.dispatch(signalSceneFail(entity))
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

function unloadParcelSceneById(sceneId: string) {
  const worker = loadedSceneWorkers.get(sceneId)
  if (!worker) {
    return
  }
  //We notify that the scene has been unloaded, the sceneId must have the same name
  parcelSceneLoadingState.lifecycleManager.notify('Scene.status', {
    sceneId: sceneId,
    status: 'unloaded'
  })
  stopParcelSceneWorker(worker)
}

/**
 * @internal
 **/
export async function loadParcelSceneByIdIfMissing(sceneId: string, entity: LoadableScene) {
  const lifecycleManager = parcelSceneLoadingState.lifecycleManager


  // create the worker if don't exis
  if (!getSceneWorkerBySceneID(sceneId)) {
    // If we are running in isolated mode and it is builder mode, we create a stateless worker instead of a normal worker
    const denyListed = isParcelDenyListed(entity.entity.metadata.scene.parcels)
    const usedEntity = denyListed ? generateBannedILand(entity) : entity

    const parcelScene = new UnityParcelScene(loadableSceneToLoadableParcelScene(usedEntity))

    parcelScene.data.useFPSThrottling = true
    const worker = loadParcelScene(parcelScene)
    setNewParcelScene(sceneId, worker)
    globalSignalSceneLoad(entity)
  }

  let timer: ReturnType<typeof setTimeout>

  const observer = sceneLifeCycleObservable.add((sceneStatus) => {
    const worker = getSceneWorkerBySceneID(sceneId)
    if (worker && sceneStatus.sceneId === sceneId && (worker.ready & SceneWorkerReadyState.STARTED) === 0) {
      sceneLifeCycleObservable.remove(observer)
      clearTimeout(timer)
      worker.ready |= SceneWorkerReadyState.STARTED
      lifecycleManager.notify('Scene.status', sceneStatus)
      globalSignalSceneStart(entity)
    }
  })

  // tell the engine to load the parcel scene
  onLoadParcelScenesObservable.notifyObservers([entity])
  const WORKER_TIMEOUT = 90000

  timer = setTimeout(() => {
    const worker = getSceneWorkerBySceneID(sceneId)
    if (worker && !worker.hasSceneStarted()) {
      sceneLifeCycleObservable.remove(observer)
      worker.ready |= SceneWorkerReadyState.LOADING_FAILED
      lifecycleManager.notify('Scene.status', { sceneId, status: 'failed' })
      globalSignalSceneFail(entity)
    }
  }, WORKER_TIMEOUT)
}

async function removeDesiredParcel(sceneId: string) {
  const desiredScenes = getDesiredParcelScenes()
  if (!hasDesiredParcelScenes(sceneId)) return
  desiredScenes.delete(sceneId)
  await setDesiredParcelScenes(desiredScenes)
}

async function addDesiredParcel(entity: LoadableScene) {
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
    scene.emit(data.eventType, data.payload)
  }
}
