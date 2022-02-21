/* eslint-disable prefer-const */
import { initParcelSceneWorker, LifecycleManager } from 'decentraland-loader/lifecycle/manager'
import { ScriptingTransport } from 'decentraland-rpc/lib/common/json-rpc/types'
import {
  sceneLifeCycleObservable,
  renderDistanceObservable
} from '../../decentraland-loader/lifecycle/controllers/scene'
import { trackEvent } from '../analytics'
import { informPendingScenes, signalSceneFail, signalSceneLoad, signalSceneStart } from '../loading/actions'
import { EnvironmentData, ILand, InstancedSpawnPoint, LoadableParcelScene } from '../types'
import { ParcelSceneAPI } from './ParcelSceneAPI'
import { parcelObservable, teleportObservable } from './positionThings'
import { SceneWorker, SceneWorkerReadyState } from './SceneWorker'
import { SceneSystemWorker } from './SceneSystemWorker'
import { ILandToLoadableParcelScene } from 'shared/selectors'
import { store } from 'shared/store/isolatedStore'
import { Observable } from '@dcl/legacy-ecs'
import { IsolatedModeOptions, IsolatedMode, StatefulWorkerOptions, ParcelSceneLoadingState } from './types'
import { UnityParcelScene } from 'unity-interface/UnityParcelScene'
import { createLogger } from 'shared/logger'
import { StatefulWorker } from './StatefulWorker'
import { UnityScene } from 'unity-interface/UnityScene'
import { Vector2Component } from 'atomicHelpers/landHelpers'
import { PositionTrackEvents } from 'shared/analytics/types'

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

const sceneManagerLogger = createLogger('scene-manager')
let lastPlayerPositionKnow: Vector2Component

export function setPlayerPosition(position: Vector2Component) {
  lastPlayerPositionKnow = position
}

export const onLoadParcelScenesObservable = new Observable<ILand[]>()
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
export function stopParcelSceneWorker(worker: SceneWorker) {
  if (worker && !worker.isPersistent()) {
    forceStopParcelSceneWorker(worker)
  }
}

export function forceStopParcelSceneWorker(worker: SceneWorker) {
  const sceneId = worker.getSceneId()
  worker.dispose()
  loadedSceneWorkers.delete(sceneId)
  reportPendingScenes()
}

/**
 * Creates a worker for the ParcelSceneAPI
 */
export function loadParcelScene(
  parcelScene: ParcelSceneAPI,
  transport?: ScriptingTransport,
  persistent: boolean = false
) {
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
export function setNewParcelScene(sceneId: string, worker: SceneWorker) {
  const parcelSceneWorker = loadedSceneWorkers.get(sceneId)

  if (worker === parcelSceneWorker) return

  if (parcelSceneWorker) {
    forceStopParcelSceneWorker(parcelSceneWorker)
  }

  loadedSceneWorkers.set(sceneId, worker)
  globalSignalSceneLoad(sceneId)
}

function globalSignalSceneLoad(sceneId: string) {
  store.dispatch(signalSceneLoad(sceneId))
  reportPendingScenes()
}

function globalSignalSceneStart(sceneId: string) {
  store.dispatch(signalSceneStart(sceneId))
  reportPendingScenes()
}

function globalSignalSceneFail(sceneId: string) {
  store.dispatch(signalSceneFail(sceneId))
  reportPendingScenes()
}

/**
 * Reports the number of loading parcel scenes to unity to handle the loading states
 */
function reportPendingScenes() {
  const pendingScenes = new Set<string>()

  let countableScenes = 0
  for (const [sceneId, sceneWorker] of loadedSceneWorkers) {
    // avatar scene should not be counted here
    const shouldBeCounted = !sceneWorker.isPersistent()

    const isPending = (sceneWorker.ready & SceneWorkerReadyState.STARTED) === 0
    const failedLoading = (sceneWorker.ready & SceneWorkerReadyState.LOADING_FAILED) !== 0
    if (shouldBeCounted) {
      countableScenes++
    }
    if (shouldBeCounted && isPending && !failedLoading) {
      pendingScenes.add(sceneId)
    }
  }

  store.dispatch(informPendingScenes(pendingScenes.size, countableScenes))
}

// @internal
export const parcelSceneLoadingState: ParcelSceneLoadingState = {
  isWorldLoadingEnabled: true,
  desiredParcelScenes: new Set<string>(),
  lifecycleManager: null as LifecycleManager | null,
  runningIsolatedMode: false,
  isolatedModeOptions: null as IsolatedModeOptions | null
}

export function startIsolatedMode(options: IsolatedModeOptions) {
  if (!parcelSceneLoadingState.lifecycleManager || !options) return

  // set the isolated mode On
  parcelSceneLoadingState.isolatedModeOptions = options
  parcelSceneLoadingState.runningIsolatedMode = true

  // put in the newSet all scenes that should remain loaded due to isolatedMode
  const newSet = new Set<string>()

  // scene id to create
  const sceneId = parcelSceneLoadingState.isolatedModeOptions.payload.sceneId
  if (sceneId && parcelSceneLoadingState.isolatedModeOptions.payload.land) {
    newSet.add(sceneId)
    parcelSceneLoadingState.lifecycleManager?.setParcelData(
      sceneId,
      parcelSceneLoadingState.isolatedModeOptions.payload.land
    )

    //If the payload specifies that we need to recreate it, we do it
    if (
      parcelSceneLoadingState.isolatedModeOptions.payload.recreateScene &&
      !newSet.has(sceneId) &&
      loadedSceneWorkers.has(sceneId)
    ) {
      // destroy old scene
      unloadParcelSceneById(sceneId)
    }
  }

  // Refresh state of scenes
  setDesiredParcelScenes(newSet)

  // We notify the lifecycle worker that the scenes are not on sight anymore
  parcelSceneLoadingState.lifecycleManager.notify('ResetScenes', {})
}

export function stopIsolatedMode(options: IsolatedModeOptions) {
  if (!parcelSceneLoadingState.runningIsolatedMode || !parcelSceneLoadingState.lifecycleManager) {
    return
  }

  // If the options don't specify to mantain the scene, we unload it
  const unloadScene = !(
    options.payload?.sceneId && options.payload.sceneId === parcelSceneLoadingState.isolatedModeOptions?.payload.sceneId
  )

  if (unloadScene) {
    unloadParcelSceneById(parcelSceneLoadingState.isolatedModeOptions?.payload.sceneId)
    parcelSceneLoadingState.desiredParcelScenes.delete(parcelSceneLoadingState.isolatedModeOptions?.payload.sceneId)
  }
  // We deactivate the isolated mode
  parcelSceneLoadingState.runningIsolatedMode = false
  parcelSceneLoadingState.isolatedModeOptions = null

  //In the builder we need to go back to the world
  if (options.mode === IsolatedMode.BUILDER) {
    // We do a teleport to go back to the world to the last position of the player
    const text = 'Going back to the world'
    teleportObservable.notifyObservers({
      x: lastPlayerPositionKnow.x,
      y: lastPlayerPositionKnow.y,
      text: text
    })
  }
}

Object.assign(globalThis, {
  startIsolatedMode,
  endIsolatedMode: stopIsolatedMode
})

/**
 *  @internal
 * Returns a set of Set<SceneId>
 */
export function getDesiredParcelScenes(): Set<string> {
  return new Set(parcelSceneLoadingState.desiredParcelScenes)
}

/**
 * @internal
 * Receives a set of Set<SceneId>
 */
export function setDesiredParcelScenes(desiredParcelScenes: Set<string>) {
  const previousSet = new Set(parcelSceneLoadingState.desiredParcelScenes)
  const newSet = (parcelSceneLoadingState.desiredParcelScenes = desiredParcelScenes)

  // react to changes
  for (const oldSceneId of previousSet) {
    if (!newSet.has(oldSceneId) && loadedSceneWorkers.has(oldSceneId)) {
      // destroy old scene
      unloadParcelSceneById(oldSceneId)
    }
  }

  for (const newSceneId of newSet) {
    if (!loadedSceneWorkers.has(newSceneId)) {
      // create new scene
      loadParcelSceneByIdIfMissing(newSceneId).catch(sceneManagerLogger.error)
    }
  }
}

function unloadParcelSceneById(sceneId: string) {
  const worker = loadedSceneWorkers.get(sceneId)
  if (!worker || !parcelSceneLoadingState.lifecycleManager) {
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
export async function loadParcelSceneByIdIfMissing(sceneId: string) {
  const lifecycleManager = parcelSceneLoadingState.lifecycleManager

  if (!lifecycleManager) return

  const parcelSceneToStart = await lifecycleManager.getParcelData(sceneId)

  // create the worker if don't exis
  if (!getSceneWorkerBySceneID(sceneId)) {
    let worker: SceneWorker

    // If we are running in isolated mode and it is builder mode, we create a stateless worker instead of a normal worker
    if (
      parcelSceneLoadingState.runningIsolatedMode &&
      parcelSceneLoadingState.isolatedModeOptions?.mode === IsolatedMode.BUILDER
    ) {
      const scene = new UnityScene({
        sceneId: sceneId,
        name: 'title',
        baseUrl: location.origin,
        main: 'fileContentUrl',
        useFPSThrottling: false,
        data: ILandToLoadableParcelScene(parcelSceneLoadingState.isolatedModeOptions?.payload?.land),
        mappings: []
      })

      const options: StatefulWorkerOptions = {
        isEmpty: true
      }

      worker = new StatefulWorker(scene, options)
    } else {
      const parcelScene = new UnityParcelScene(ILandToLoadableParcelScene(parcelSceneToStart))

      parcelScene.data.useFPSThrottling = true
      worker = loadParcelScene(parcelScene)
    }

    setNewParcelScene(sceneId, worker)
  }

  let timer: ReturnType<typeof setTimeout>

  const observer = sceneLifeCycleObservable.add((sceneStatus) => {
    const worker = getSceneWorkerBySceneID(sceneId)
    if (worker && sceneStatus.sceneId === sceneId && (worker.ready & SceneWorkerReadyState.STARTED) === 0) {
      sceneLifeCycleObservable.remove(observer)
      clearTimeout(timer)
      worker.ready |= SceneWorkerReadyState.STARTED
      lifecycleManager.notify('Scene.status', sceneStatus)
      globalSignalSceneStart(sceneId)
    }
  })

  // tell the engine to load the parcel scene
  onLoadParcelScenesObservable.notifyObservers([parcelSceneToStart])
  const WORKER_TIMEOUT = 90000

  timer = setTimeout(() => {
    const worker = getSceneWorkerBySceneID(sceneId)
    if (worker && !worker.hasSceneStarted()) {
      sceneLifeCycleObservable.remove(observer)
      worker.ready |= SceneWorkerReadyState.LOADING_FAILED
      lifecycleManager.notify('Scene.status', { sceneId, status: 'failed' })
      globalSignalSceneFail(sceneId)
    }
  }, WORKER_TIMEOUT)
}

export async function enableParcelSceneLoading() {
  const lifecycleManager = await initParcelSceneWorker()

  parcelSceneLoadingState.lifecycleManager = lifecycleManager

  lifecycleManager.on('Scene.shouldPrefetch', async (opts: { sceneId: string }) => {
    await lifecycleManager.getParcelData(opts.sceneId)
    // continue with the loading
    lifecycleManager.notify('Scene.prefetchDone', opts)
  })

  lifecycleManager.on('Scene.shouldStart', async (opts: { sceneId: string }) => {
    const desiredScenes = getDesiredParcelScenes()
    desiredScenes.add(opts.sceneId)
    setDesiredParcelScenes(desiredScenes)
  })

  lifecycleManager.on('Scene.shouldUnload', async (opts: { sceneId: string }) => {
    const desiredScenes = getDesiredParcelScenes()
    desiredScenes.delete(opts.sceneId)
    setDesiredParcelScenes(desiredScenes)
  })

  lifecycleManager.on('Position.settled', async (opts: { spawnPoint: InstancedSpawnPoint }) => {
    onPositionSettledObservable.notifyObservers(opts.spawnPoint)
  })

  lifecycleManager.on('Position.unsettled', () => {
    onPositionUnsettledObservable.notifyObservers({})
  })

  lifecycleManager.on(
    'Event.track',
    <T extends keyof PositionTrackEvents>(event: { name: T; data: PositionTrackEvents[T] }) => {
      trackEvent(event.name, event.data)
    }
  )

  teleportObservable.add((position: { x: number; y: number }) => {
    setPlayerPosition(position)
    if (parcelSceneLoadingState.runningIsolatedMode) return
    lifecycleManager.notify('User.setPosition', { position, teleported: true })
  })

  renderDistanceObservable.add((event) => {
    lifecycleManager.notify('SetScenesLoadRadius', event)
  })

  parcelObservable.add((obj) => {
    // immediate reposition should only be broadcasted to others, otherwise our scene reloads
    if (obj.immediate) return
    setPlayerPosition(obj.newParcel)

    // If we are in isolated mode we don't report the position
    if (parcelSceneLoadingState.runningIsolatedMode) return
    lifecycleManager.notify('User.setPosition', {
      position: obj.newParcel,
      teleported: false
    })
  })
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
