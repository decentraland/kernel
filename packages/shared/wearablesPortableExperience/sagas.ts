import { select, takeEvery, takeLatest } from '@redux-saga/core/effects'
import { put } from 'redux-saga-test-plan/matchers'
import { wearablesRequest, WearablesSuccess, WEARABLES_SUCCESS } from 'shared/catalogs/actions'
import { getFetchContentServer } from 'shared/dao/selectors'
import defaultLogger from 'shared/logger'
import { ProfileSuccessAction, PROFILE_SUCCESS } from 'shared/profiles/actions'
import { getCurrentUserId } from 'shared/session/selectors'
import { store } from 'shared/store/isolatedStore'
import { WearableId } from 'shared/types'
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
  const currentWearables: WearableId[] = yield select(getCurrentWearables)
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
  const pendingWearables: WearableId[] = yield select(getPendingWearables)

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
    w.data.representations.some((r) => r.contents.some((c) => c.endsWith('game.js')))
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

  for (const wearable of wearables) {
    try {
      const baseUrl = wearable.baseUrl ?? fetchContentServer + '/contents/'

      // Get the wearable content containing the game.js
      const wearableContent = wearable.data.representations.filter((r) =>
        r.contents.some((c) => c.endsWith('game.js'))
      )[0].contents

      // In the deployment the content was replicated when the bodyShape selected was 'both'
      //  this add the prefix 'female/' or '/male' if they have more than one representations.
      // So, the scene (for now) is the same for both. We crop this prefix and keep the scene tree folder

      const femaleCrop = wearableContent.filter(($) => $.substr(0, 7) === 'female/').length === wearableContent.length
      const maleCrop = wearableContent.filter(($) => $.substr(0, 5) === 'male/').length === wearableContent.length

      const getFile = (key: string): string => {
        if (femaleCrop) return key.substring(7)
        if (maleCrop) return key.substring(5)
        return key
      }

      const mappings = wearableContent.map(($) => ({ file: getFile($), hash: $ }))
      const name = wearable.descriptions[0].text

      spawnPortableExperience(wearable.id, 'main', name, baseUrl, mappings, wearable.menuBarIcon).catch((e) =>
        defaultLogger.error(e)
      )
    } catch (e) {
      defaultLogger.log(e)
    }
  }
}
