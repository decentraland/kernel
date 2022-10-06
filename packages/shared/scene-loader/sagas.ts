import { fork, put, takeEvery } from 'redux-saga/effects'
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
  SetParcelPosition,
  setSceneLoader,
  SET_PARCEL_POSITION
} from './actions'
import {} from './genesis-city-loader-impl'
import {} from './world-loader-impl'
import { getSceneLoader } from './selectors'

export function* sceneLoaderSaga() {
  yield takeEvery(SET_BFF, onSetBff)
  yield takeEvery(SET_PARCEL_POSITION, onWorldPositionChange)
  yield takeEvery(POSITION_SETTLED, onPositionSettled)
  yield takeEvery(POSITION_UNSETTLED, onPositionUnsettled)
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
    if (PARCEL_LOADING_ENABLED) {
      // await enableParcelSceneLoading(params)
    }

    if (DECENTRALAND_SPACE) {
      const px = await getPortableExperienceFromUrn(DECENTRALAND_SPACE)
      await addDesiredParcel(px)
      // onPositionSettledObservable.notifyObservers(pickWorldSpawnpoint(px.entity.metadata as Scene))
    }

    yield put(signalParcelLoadingStarted())
  }
}

// This saga reacts to every parcel position change
function* onWorldPositionChange(action: SetParcelPosition) {}

// This saga reacts to certain events and evaluates if a change in the
// scene loader is needed
function* handleNewSceneLoader() {
  // for every BFF, evaluate if genesis city needs to be loaded
  // if we are creating a new scene loader, then the POI and minimap should be updated
}

export async function fetchScenesByLocation(positions: string[]): Promise<LoadableScene[]> {
  const sceneLoader = getSceneLoader(store.getState())
  if (!sceneLoader) return []
  const { scenes } = await sceneLoader.fetchScenesByLocation(positions)
  return scenes
}
