import { apply, call, delay, fork, put, race, select, take, takeEvery, takeLatest } from 'redux-saga/effects'
import { SetBffAction, SET_BFF } from 'shared/bff/actions'
import { IBff } from 'shared/bff/types'
import { signalParcelLoadingStarted } from 'shared/renderer/actions'
import { store } from 'shared/store/isolatedStore'
import { LoadableScene } from 'shared/types'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import {
  positionSettled,
  PositionSettled,
  positionUnsettled,
  POSITION_SETTLED,
  POSITION_UNSETTLED,
  setParcelPosition,
  setSceneLoader,
  SET_PARCEL_POSITION,
  SET_SCENE_LOADER,
  SET_WORLD_LOADING_RADIUS,
  TeleportToAction,
  TELEPORT_TO
} from './actions'
import { createGenesisCityLoader } from './genesis-city-loader-impl'
import { createWorldLoader } from './world-loader-impl'
import {
  getLoadingRadius,
  getParcelPosition,
  isPositionSettled,
  getPositionSpawnPointAndScene,
  getSceneLoader
} from './selectors'
import { getFetchContentServerFromBff } from 'shared/bff/selectors'
import { ISceneLoader, SceneLoaderPositionReport, SetDesiredScenesCommand } from './types'
import { getSceneWorkerBySceneID, setDesiredParcelScenes } from 'shared/world/parcelSceneManager'
import { BEFORE_UNLOAD } from 'shared/actions'
import {
  SceneFail,
  SceneStart,
  SceneUnload,
  SCENE_FAIL,
  SCENE_START,
  SCENE_UNLOAD,
  updateLoadingScreen
} from 'shared/loading/actions'
import { SceneWorker } from 'shared/world/SceneWorker'
import { pickWorldSpawnpoint, receivePositionReport } from 'shared/world/positionThings'
import { worldToGrid } from 'atomicHelpers/parcelScenePositions'
import { waitForRendererInstance } from 'shared/renderer/sagas-helper'

export function* sceneLoaderSaga() {
  yield takeEvery(SET_BFF, onSetBff)
  yield takeEvery([POSITION_SETTLED, POSITION_UNSETTLED], onPositionSettled)
  yield takeLatest(TELEPORT_TO, teleportHandler)
  yield fork(rendererPositionSettler)
  yield fork(onWorldPositionChange)
  yield fork(positionSettler)
}

function* waitForSceneLoader() {
  while (true) {
    const loader: ISceneLoader | undefined = yield select(getSceneLoader)
    if (loader) return loader
    yield take(SET_SCENE_LOADER)
  }
}

/*
Position settling algorithm:
- If the user teleports to a scene that is not present or not loaded
  AND the target scene exists, then UnsettlePosition(targetScene)
- If the user teleports to a scene that is loaded
  THEN SettlePosition(spawnPoint(scene))
- If the position is unsettled, and the scene that unsettled the position loads or fails loading
  THEN SettlePosition(spawnPoint(scene))

A scene can fail loading due to an error or timeout.
*/

function* teleportHandler(action: TeleportToAction) {
  const sceneLoader: ISceneLoader = yield call(waitForSceneLoader)

  // look for the target scene
  const { x, y } = worldToGrid(action.payload.position)
  const pointer = `${x},${y}`
  const command: SetDesiredScenesCommand = yield apply(sceneLoader, sceneLoader.fetchScenesByLocation, [[pointer]])

  // is a target scene, then it will be used to settle the position
  if (command && command.scenes && command.scenes.length) {
    // pick always the first scene to unsettle the position once loaded
    const settlerScene = command.scenes[0].id

    const scene: SceneWorker | undefined = yield call(getSceneWorkerBySceneID, settlerScene)

    const spawnPoint = pickWorldSpawnpoint(scene?.metadata || command.scenes[0].entity.metadata) || action.payload
    if (scene) {
      // if the scene is loaded then there is no unsettlement of the position
      // we teleport directly to that scene
      yield put(positionSettled(spawnPoint))
    } else {
      // set the unsettler once again using the proper ID
      yield put(positionUnsettled(settlerScene, spawnPoint))
    }
  } else {
    // if there is no scene to load at the target position, then settle the position
    // to activate the renderer. otherwise there will be no event to activate the renderer
    yield put(positionSettled(action.payload))
  }
}

function* rendererPositionSettler() {
  // wait for renderer
  yield call(waitForRendererInstance)

  while (true) {
    const isSettled: boolean = yield select(isPositionSettled)
    const spawnPointAndScene: ReturnType<typeof getPositionSpawnPointAndScene> = yield select(
      getPositionSpawnPointAndScene
    )

    // and then settle the position
    if (!isSettled) {
      // Then set the parcel position for the scene loader
      receivePositionReport(spawnPointAndScene.spawnPoint.position)
    }
    // then update the position in the engine
    getUnityInstance().Teleport(spawnPointAndScene.spawnPoint)

    yield take([POSITION_SETTLED, POSITION_UNSETTLED])
  }
}

function* onPositionSettled(action: PositionSettled | PositionSettled) {
  // set the parcel position for the scene loader
  yield put(setParcelPosition(worldToGrid(action.payload.spawnPoint.position)))
}

// This saga reacts to new realms/bff and creates the proper scene loader
function* onSetBff(action: SetBffAction) {
  const bff: IBff | undefined = action.payload

  if (!bff) {
    yield put(setSceneLoader(undefined))
  } else {
    // if the /about endpoint returns scenesUrn(s) then those need to be loaded
    // and the genesis city should not start
    const loadFixedWorld = !!bff.about.configurations?.scenesUrn?.length

    if (loadFixedWorld) {
      const loader: ISceneLoader = yield call(createWorldLoader, {
        urns: bff!.about.configurations!.scenesUrn
      })
      yield put(setSceneLoader(loader))
    } else {
      // const enableEmptyParcels = ENABLE_EMPTY_SCENES && !(globalThis as any)['isRunningTests']

      const loader: ISceneLoader = yield call(createGenesisCityLoader, {
        contentServer: getFetchContentServerFromBff(bff)
        // TODO: re-activate empty parcels
        // emptyParcelsBaseUrl
      })
      yield put(setSceneLoader(loader))
    }

    yield put(signalParcelLoadingStarted())

    yield put(updateLoadingScreen())
  }
}

/**
 * This saga listens for scene loading messages (load, start, fail) and if there
 * is one scene that is going to settle our position, the event is used to dispach
 * the positionSettled(spawnPoint(scene)) action. Which is used to deactivate the
 * loading screen.
 */
function* positionSettler() {
  while (true) {
    const reason: SceneStart | SceneFail | SceneUnload = yield take([SCENE_START, SCENE_FAIL, SCENE_UNLOAD])

    const sceneId: string = reason.payload?.id

    if (!sceneId) throw new Error('Error in logic of positionSettler saga')

    const settled: boolean = yield select(isPositionSettled)
    const spawnPointAndScene: ReturnType<typeof getPositionSpawnPointAndScene> = yield select(
      getPositionSpawnPointAndScene
    )

    if (!settled && sceneId === spawnPointAndScene?.sceneId) {
      if (reason.type === SCENE_START) {
        yield delay(100)
      }
      yield put(positionSettled(spawnPointAndScene.spawnPoint))
    }
  }
}

// This saga reacts to every parcel position change and signals the scene loader
// about it
function* onWorldPositionChange() {
  while (true) {
    const reason = yield race({
      timeout: delay(5000),
      newSceneLoader: take(SET_SCENE_LOADER),
      newParcel: take(SET_PARCEL_POSITION),
      SCENE_START: take(SCENE_START),
      newLoadingRadius: take(SET_WORLD_LOADING_RADIUS),
      unload: take(BEFORE_UNLOAD)
    })

    if (reason.unload) return

    const sceneLoader: ISceneLoader | undefined = yield select(getSceneLoader)

    if (sceneLoader) {
      const position: ReadOnlyVector2 = yield select(getParcelPosition)
      const loadingRadius: number = yield select(getLoadingRadius)
      const report: SceneLoaderPositionReport = {
        loadingRadius,
        position,
        teleported: false
      }

      const command: SetDesiredScenesCommand = yield apply(sceneLoader, sceneLoader.reportPosition, [report])

      const map = new Map<string, LoadableScene>()

      for (const scene of command.scenes) {
        map.set(scene.id, scene)
      }

      yield call(setDesiredParcelScenes, map)
    }
  }
}

export async function fetchScenesByLocation(positions: string[]): Promise<LoadableScene[]> {
  const sceneLoader = getSceneLoader(store.getState())
  if (!sceneLoader) return []
  const { scenes } = await sceneLoader.fetchScenesByLocation(positions)
  return scenes
}
