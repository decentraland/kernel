import { apply, call, delay, fork, put, race, select, take, takeEvery } from 'redux-saga/effects'
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
  setSceneLoader,
  SET_PARCEL_POSITION,
  SET_SCENE_LOADER,
  SET_WORLD_LOADING_RADIUS,
  TeleportToAction,
  TELEPORT_TO
} from './actions'
import { createGenesisCityLoader } from './genesis-city-loader-impl'
import { createWorldLoader } from './world-loader-impl'
import { getLoadingRadius, getParcelPosition, getPositionSettled, getSceneLoader } from './selectors'
import { getFetchContentServerFromBff } from 'shared/bff/selectors'
import { ISceneLoader, SceneLoaderPositionReport, SetDesiredScenesCommand } from './types'
import { getLoadedParcelSceneByPointer, setDesiredParcelScenes } from 'shared/world/parcelSceneManager'
import { BEFORE_UNLOAD } from 'shared/actions'
import { SCENE_FAIL, SCENE_LOAD, SCENE_START } from 'shared/loading/actions'
import { getCurrentScene } from 'shared/world/selectors'
import { SET_CURRENT_SCENE } from 'shared/world/actions'
import { SceneWorker } from 'shared/world/SceneWorker'
import { lastPlayerPosition, pickWorldSpawnpoint } from 'shared/world/positionThings'
import { worldToGrid } from 'atomicHelpers/parcelScenePositions'

export function* sceneLoaderSaga() {
  yield takeEvery(SET_BFF, onSetBff)
  yield takeEvery(POSITION_SETTLED, onPositionSettled)
  yield takeEvery(POSITION_UNSETTLED, onPositionUnsettled)
  yield takeEvery(TELEPORT_TO, teleportHandler)
  yield fork(onWorldPositionChange)
  yield fork(positionSettler)
}

function* teleportHandler(action: TeleportToAction) {
  //
  const { x, y } = worldToGrid(action.payload.position)
  const pointer = `${x},${y}`
  const sceneLoaded: SceneWorker | undefined = yield call(getLoadedParcelSceneByPointer, pointer)

  if (sceneLoaded) {
    const spawnPoint = pickWorldSpawnpoint(sceneLoaded.metadata)
    yield put(positionSettled(spawnPoint.position, spawnPoint.cameraTarget))
  } else {
    getUnityInstance().Teleport(action.payload)
    yield put(positionUnsettled())
  }
}

function* onPositionSettled(action: PositionSettled) {
  lastPlayerPosition.copyFrom(action.payload.position)
  getUnityInstance().Teleport(action.payload)
  // TODO: move this to LOADING saga
  getUnityInstance().ActivateRendering()
}

function* onPositionUnsettled() {
  // TODO: move this to LOADING saga
  getUnityInstance().DeactivateRendering()
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
  }
}

function* positionSettler() {
  while (true) {
    const reason = yield race({
      SCENE_LOAD: take(SCENE_LOAD),
      SCENE_START: take(SCENE_START),
      SCENE_FAIL: take(SCENE_FAIL),
      UNSETTLED: take(POSITION_UNSETTLED),
      SET_CURRENT_SCENE: take(SET_CURRENT_SCENE)
    })

    const settled: boolean = yield select(getPositionSettled)
    const currentScene: SceneWorker | undefined = yield select(getCurrentScene)

    console.log({ settled, reason, currentScene })

    if (!settled && currentScene?.sceneReady) {
      const spawn = pickWorldSpawnpoint(currentScene!.metadata)
      yield put(positionSettled(spawn.position, spawn.cameraTarget))
    }
  }
}

// This saga reacts to every parcel position change and signals the scene loader
// about it
function* onWorldPositionChange() {
  while (true) {
    const { unload } = yield race({
      timeout: delay(5000),
      newSceneLoader: take(SET_SCENE_LOADER),
      newParcel: take(SET_PARCEL_POSITION),
      SCENE_START: take(SCENE_START),
      newLoadingRadius: take(SET_WORLD_LOADING_RADIUS),
      unload: take(BEFORE_UNLOAD)
    })

    if (unload) return

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

      setDesiredParcelScenes(map)
    }
  }
}

export async function fetchScenesByLocation(positions: string[]): Promise<LoadableScene[]> {
  const sceneLoader = getSceneLoader(store.getState())
  if (!sceneLoader) return []
  const { scenes } = await sceneLoader.fetchScenesByLocation(positions)
  return scenes
}
