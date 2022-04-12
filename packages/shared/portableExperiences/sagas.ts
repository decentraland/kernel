import { call, takeEvery, debounce, select, put } from 'redux-saga/effects'
import { StorePortableExperience } from 'shared/types'
import {
  ADD_DESIRED_PORTABLE_EXPERIENCE,
  REMOVE_DESIRED_PORTABLE_EXPERIENCE
} from 'shared/wearablesPortableExperience/actions'
import { declareWantedPortableExperiences } from 'unity-interface/portableExperiencesUtils'
import {
  ADD_SCENE_PX,
  DENY_PORTABLE_EXPERIENCES,
  ReloadScenePortableExperienceAction,
  RELOAD_SCENE_PX,
  REMOVE_SCENE_PX,
  updateEnginePortableExperiences,
  UpdateEnginePortableExperiencesAction,
  UPDATE_ENGINE_PX, denyPortableExperiences, KILL_ALL_PORTABLE_EXPERIENCES
} from './actions'
import {getDesiredPortableExperiences, getPortableExperiencesCreatedByScenes} from './selectors'
import {store} from "../store/isolatedStore";
import {getDesiredLoadableWearablePortableExpriences} from "../wearablesPortableExperience/selectors";

export function* portableExperienceSaga(): any {
  yield takeEvery(REMOVE_DESIRED_PORTABLE_EXPERIENCE, handlePortableExperienceChanges)
  yield takeEvery(ADD_DESIRED_PORTABLE_EXPERIENCE, handlePortableExperienceChanges)
  yield takeEvery(KILL_ALL_PORTABLE_EXPERIENCES, killAllPortableExperience)
  yield takeEvery(DENY_PORTABLE_EXPERIENCES, handlePortableExperienceChanges)
  yield takeEvery(ADD_SCENE_PX, handlePortableExperienceChanges)
  yield takeEvery(REMOVE_SCENE_PX, handlePortableExperienceChanges)
  yield takeEvery(RELOAD_SCENE_PX, reloadPortableExperienceChanges)
  yield debounce(100 /* ms */, UPDATE_ENGINE_PX, handlePortableExperienceChangesEffect)
}

// every time the desired portable experiences change, the action `updateEnginePortableExperiences` should be dispatched
function* handlePortableExperienceChanges() {
  const desiredPortableExperiences = yield select(getDesiredPortableExperiences)
  yield put(updateEnginePortableExperiences(desiredPortableExperiences))
}

function* killAllPortableExperience(){
  const pex: StorePortableExperience[] =
    [
      ...getPortableExperiencesCreatedByScenes(store.getState()),
      ...getDesiredLoadableWearablePortableExpriences(store.getState())
    ]
  yield put(denyPortableExperiences(pex.map(p => p.id)))
}

// reload portable experience
function* reloadPortableExperienceChanges(action: ReloadScenePortableExperienceAction) {
  const allDesiredPortableExperiences: StorePortableExperience[] = yield select(getDesiredPortableExperiences)

  const filteredDesiredPortableExperiences = allDesiredPortableExperiences.filter(
    ($) => $.id !== action.payload.data.id
  )

  // unload the filtered PX
  yield call(declareWantedPortableExperiences, filteredDesiredPortableExperiences)
  // reload all PX
  yield call(declareWantedPortableExperiences, allDesiredPortableExperiences)
}

// tell the controller which PXs we do want running
function* handlePortableExperienceChangesEffect(action: UpdateEnginePortableExperiencesAction) {
  yield call(declareWantedPortableExperiences, action.payload.desiredPortableExperiences)
}
