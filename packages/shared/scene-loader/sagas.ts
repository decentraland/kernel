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
  POSITION_SETTLED,
  POSITION_UNSETTLED,
  setSceneLoader,
  SET_PARCEL_POSITION,
  SET_SCENE_LOADER,
  SET_WORLD_LOADING_RADIUS
} from './actions'
import { createGenesisCityLoader } from './genesis-city-loader-impl'
import { createWorldLoader } from './world-loader-impl'
import { getLoadingRadius, getParcelPosition, getPositionSettled, getSceneLoader } from './selectors'
import { getFetchContentServerFromBff } from 'shared/bff/selectors'
import { ISceneLoader, SceneLoaderPositionReport, SetDesiredScenesCommand } from './types'
import { setDesiredParcelScenes } from 'shared/world/parcelSceneManager'
import { BEFORE_UNLOAD } from 'shared/actions'
import { SCENE_FAIL, SCENE_LOAD, SCENE_START } from 'shared/loading/actions'
import { getCurrentScene } from 'shared/world/selectors'
import { SET_CURRENT_SCENE } from 'shared/world/actions'
import { SceneWorker } from 'shared/world/SceneWorker'
import { lastPlayerPosition, pickWorldSpawnpoint } from 'shared/world/positionThings'
import { Vector3 } from '@dcl/ecs-math'

export function* sceneLoaderSaga() {
  yield takeEvery(SET_BFF, onSetBff)
  yield takeEvery(POSITION_SETTLED, onPositionSettled)
  yield takeEvery(POSITION_UNSETTLED, onPositionUnsettled)
  yield fork(onWorldPositionChange)
  yield fork(positionSettler)
}

function* onPositionSettled(action: PositionSettled) {
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

    if ((!settled && currentScene?.sceneReady) || (!settled && !currentScene && reason.SCENE_LOAD)) {
      const spawn = currentScene
        ? pickWorldSpawnpoint(currentScene!.metadata)
        : { position: lastPlayerPosition, cameraTarget: Vector3.Forward() }
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
