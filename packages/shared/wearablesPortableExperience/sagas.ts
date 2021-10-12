import { select, takeEvery, takeLatest } from '@redux-saga/core/effects'
import { put } from 'redux-saga-test-plan/matchers'
import { wearablesRequest, WearablesSuccess, WEARABLES_SUCCESS } from 'shared/catalogs/actions'
import { getFetchContentServer } from 'shared/dao/selectors'
import defaultLogger from 'shared/logger'
import { ProfileSuccessAction, PROFILE_SUCCESS } from 'shared/profiles/actions'
import { getCurrentUserId } from 'shared/session/selectors'
import { store } from 'shared/store/isolatedStore'
import {
  getCurrentWearables,
  getPendingWearables,
  isRunningPortableExperience
} from 'shared/wearablesPortableExperience/selectors'
import { killPortableExperienceScene, spawnPortableExperience } from 'unity-interface/portableExperiencesUtils'
import {
  processWearables,
  ProcessWearablesAction,
  PROCESS_WEARABLES,
  startWearablesPortableExperience,
  StartWearablesPortableExperienceAction,
  START_WEARABLES_PORTABLE_EXPERENCE,
  stopWearablesPortableExperience,
  StopWearablesPortableExperienceAction,
  STOP_WEARABLES_PORTABLE_EXPERENCE,
  updateWearables,
  UpdateWearablesAction,
  UPDATE_WEARABLES
} from './actions'

export function* wearablesPortableExperienceSaga(): any {
  yield takeLatest(PROFILE_SUCCESS, handleProfileSuccess)
  yield takeLatest(UPDATE_WEARABLES, handleWearablesUpdate)
  yield takeEvery(WEARABLES_SUCCESS, handleWearablesSuccess)
  yield takeEvery(PROCESS_WEARABLES, handleProcessWearables)
  yield takeEvery(STOP_WEARABLES_PORTABLE_EXPERENCE, handleStopWearablesPortableExperience)
  yield takeEvery(START_WEARABLES_PORTABLE_EXPERENCE, handleStartWearablesPortableExperience)
}

function* handleProfileSuccess(action: ProfileSuccessAction): any {
  if ((yield select(getCurrentUserId)) !== action.payload.userId) {
    return
  }

  const profileWearables = action.payload.profile.avatar.wearables
  const currentWearables = getCurrentWearables(store.getState())
  const wearablesToAdd = profileWearables.filter((w) => !currentWearables.includes(w))
  const wearablesToRemove = currentWearables.filter((w) => !profileWearables.includes(w))

  yield put(updateWearables(wearablesToAdd, wearablesToRemove))
}

function* handleWearablesUpdate(action: UpdateWearablesAction): any {
  const portableExperiencesToStop = action.payload.wearablesToRemove.filter((w) =>
    isRunningPortableExperience(store.getState(), w)
  )

  if (portableExperiencesToStop.length > 0) {
    yield put(stopWearablesPortableExperience(portableExperiencesToStop))
  }

  if (action.payload.wearablesToAdd.length > 0) {
    yield put(wearablesRequest({ wearableIds: action.payload.wearablesToAdd }))
  }
}

function* handleWearablesSuccess(action: WearablesSuccess): any {
  const pendingWearables = getPendingWearables(store.getState())

  if (pendingWearables.length === 0) {
    return
  }

  const { wearables } = action.payload
  const wearablesToProcess = wearables.filter((w) => pendingWearables.includes(w.id))

  if (wearablesToProcess.length > 0) {
    yield put(processWearables(wearablesToProcess))
  }
}

function* handleProcessWearables(action: ProcessWearablesAction): any {
  const { wearables } = action.payload

  const wearablesWithPortableExperiences = wearables.filter((w) =>
    w.data.representations.some((r) => r.contents.some((c) => c.key.includes('game.js')))
  )

  if (wearablesWithPortableExperiences.length > 0) {
    yield put(startWearablesPortableExperience(wearablesWithPortableExperiences))
  }
}

function* handleStopWearablesPortableExperience(action: StopWearablesPortableExperienceAction): any {
  const { wearables } = action.payload
  wearables.forEach((wId) => killPortableExperienceScene(wId))
}

function* handleStartWearablesPortableExperience(action: StartWearablesPortableExperienceAction): any {
  const { wearables } = action.payload
  const fetchContentServer: string = yield select(getFetchContentServer)

  for (let wearable of wearables) {
    try {
      const baseUrl = wearable.baseUrl ?? fetchContentServer + '/contents/'

      const mappings = wearable.data.representations
        .filter((r) => r.contents.some((c) => c.key.includes('game.js')))[0]
        .contents.map((c) => ({ file: c.key, hash: c.hash }))

      const name = wearable.i18n[0].text
      const icon = wearable.thumbnail.split('/').pop()

      spawnPortableExperience(wearable.id, 'main', name, baseUrl, mappings, icon)
    } catch (e) {
      defaultLogger.log(e as any)
    }
  }
}
