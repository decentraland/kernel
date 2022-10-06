import { apply, call, put, select, take, takeEvery, takeLatest } from 'redux-saga/effects'
import { SetBffAction, SET_BFF } from 'shared/bff/actions'
import { IBff } from 'shared/bff/types'
import { signalParcelLoadingStarted } from 'shared/renderer/actions'
import { store } from 'shared/store/isolatedStore'
import { LoadableScene } from 'shared/types'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import {
  PositionSettled,
  POSITION_SETTLED,
  POSITION_UNSETTLED,
  setSceneLoader,
  SET_PARCEL_POSITION,
  SET_SCENE_LOADER
} from './actions'
import { createGenesisCityLoader } from './genesis-city-loader-impl'
import { createWorldLoader } from './world-loader-impl'
import { getLoadingRadius, getParcelPosition, getSceneLoader } from './selectors'
import { getFetchContentServerFromBff } from 'shared/bff/selectors'
import { ISceneLoader, SceneLoaderPositionReport, SetDesiredScenesCommand } from './types'
import { setDesiredParcelScenes } from 'shared/world/parcelSceneManager'

export function* sceneLoaderSaga() {
  yield takeEvery(SET_BFF, onSetBff)
  yield takeEvery([SET_PARCEL_POSITION, SET_SCENE_LOADER], onWorldPositionChange)
  yield takeEvery(POSITION_SETTLED, onPositionSettled)
  yield takeEvery(POSITION_UNSETTLED, onPositionUnsettled)
  yield takeLatest(SET_SCENE_LOADER, handleNewSceneLoader)
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

// This saga reacts to every parcel position change and signals the scene loader
// about it
function* onWorldPositionChange() {
  const sceneLoader: ISceneLoader | undefined = yield select(getSceneLoader)
  if (sceneLoader) {
    const position: ReadOnlyVector2 = yield select(getParcelPosition)
    const loadingRadius: number = yield select(getLoadingRadius)
    const report: SceneLoaderPositionReport = {
      loadingRadius,
      position,
      teleported: false
    }
    yield apply(sceneLoader, sceneLoader.reportPosition, [report])
  }
}

// This saga reacts to certain events and evaluates if a change in the
// scene loader is needed
// IMPORTANT!!!!!!!!!!! This saga is designed to work ONLY with takeLatest
function* handleNewSceneLoader() {
  // for every BFF, evaluate if genesis city needs to be loaded
  // if we are creating a new scene loader, then the POI and minimap should be updated
  const loader: ISceneLoader | undefined = yield select(getSceneLoader)
  if (!loader) return

  debugger
  // TODO: refresh POI
  // TODO: refresh minimap

  const chan = loader.getChannel()
  while (true) {
    const command: SetDesiredScenesCommand = yield take(chan)

    const map = new Map<string, LoadableScene>()

    for (const scene of command.scenes) {
      map.set(scene.id, scene)
    }

    setDesiredParcelScenes(map)
  }
}

export async function fetchScenesByLocation(positions: string[]): Promise<LoadableScene[]> {
  const sceneLoader = getSceneLoader(store.getState())
  if (!sceneLoader) return []
  const { scenes } = await sceneLoader.fetchScenesByLocation(positions)
  return scenes
}
