import { call, select, takeLatest } from 'redux-saga/effects'
import { SceneSystemWorker } from 'shared/world/SceneSystemWorker'
import { toEnvironmentRealmType } from '../apis/EnvironmentAPI'
import { SetCommsIsland, SET_COMMS_ISLAND } from '../comms/actions'
import { getCommsIsland } from '../comms/selectors'
import { SetCatalystRealm, SET_CATALYST_REALM } from '../dao/actions'
import { getRealm } from '../dao/selectors'
import { Realm } from '../dao/types'
import { SaveProfileSuccess, SAVE_PROFILE_SUCCESS } from '../profiles/actions'
import { takeLatestByUserId } from '../profiles/sagas'
import { allScenesEvent, loadedSceneWorkers } from '../world/parcelSceneManager'
import { SetCameraMode, SET_CAMERA_MODE } from './actions'

export function* sceneEventsSaga() {
  yield takeLatest(SET_CATALYST_REALM, realmChanged)
  yield takeLatest(SET_COMMS_ISLAND, islandChanged)
  yield takeLatestByUserId(SAVE_PROFILE_SUCCESS, submitProfileToScenes)
  yield takeLatest(SET_CAMERA_MODE, setCameraMode)
}

function* realmChanged(action: SetCatalystRealm) {
  const realm = action.payload
  const island: string = (yield select(getCommsIsland)) ?? ''

  const payload = toEnvironmentRealmType(realm, island)
  yield call(allScenesEvent, { eventType: 'onRealmChanged', payload })
}

function* islandChanged(action: SetCommsIsland) {
  const realm: Realm = yield select(getRealm)
  const island = action.payload.island ?? ''

  if (!realm) {
    return
  }

  const payload = toEnvironmentRealmType(realm, island)
  yield call(allScenesEvent, { eventType: 'onRealmChanged', payload })
}

function* submitProfileToScenes(action: SaveProfileSuccess) {
  yield call(allScenesEvent, {
    eventType: 'profileChanged',
    payload: {
      ethAddress: action.payload.profile.ethAddress,
      version: action.payload.profile.version
    }
  })
}

function* setCameraMode(action: SetCameraMode) {
  const { cameraMode, sceneId } = action.payload
  const scenes = sceneId ? [loadedSceneWorkers.get(sceneId)] : loadedSceneWorkers.values()
  for (const worker of scenes) {
    const sceneSystemWorker = worker as SceneSystemWorker
    sceneSystemWorker?.setCameraMode(cameraMode)
  }
}
