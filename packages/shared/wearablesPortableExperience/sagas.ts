import { select, takeEvery, takeLatest } from '@redux-saga/core/effects'
import { put } from 'redux-saga-test-plan/matchers'
import { wearablesRequest, WearablesSuccess, WEARABLES_SUCCESS } from 'shared/catalogs/actions'
import { getFetchContentServer } from 'shared/dao/selectors'
import defaultLogger from 'shared/logger'
import { ProfileSuccessAction, PROFILE_SUCCESS } from 'shared/profiles/actions'
import { getCurrentUserId } from 'shared/session/selectors'
import { StorePortableExperience } from 'shared/types'
import { getDesiredWearablePortableExpriences } from 'shared/wearablesPortableExperience/selectors'
import {
  addDesiredPortableExperience,
  processWearables,
  ProcessWearablesAction,
  PROCESS_WEARABLES,
  removeDesiredPortableExperience
} from './actions'

export function* wearablesPortableExperienceSaga(): any {
  yield takeLatest(PROFILE_SUCCESS, handleProfileSuccess)
  yield takeEvery(WEARABLES_SUCCESS, handleWearablesSuccess)
  yield takeEvery(PROCESS_WEARABLES, handleProcessWearables)
}

function* handleProfileSuccess(action: ProfileSuccessAction): any {
  if ((yield select(getCurrentUserId)) !== action.payload.userId) {
    return
  }

  const newProfileWearables = action.payload.profile.avatar.wearables
  const currentDesiredPortableExperiences: Record<string, StorePortableExperience | null> = yield select(
    getDesiredWearablePortableExpriences
  )

  // if the PX is no-longer present in the new profile then remove it from the "desired" list
  for (const id of Object.keys(currentDesiredPortableExperiences)) {
    if (!newProfileWearables.includes(id)) {
      yield put(removeDesiredPortableExperience(id))
    }
  }

  // create a list of wearables to load
  const wearablesToAdd: string[] = []
  for (const id of newProfileWearables) {
    if (!(id in currentDesiredPortableExperiences)) {
      yield put(addDesiredPortableExperience(id, null))
    }
  }

  // TODO: use the catalog for this. The information is already available somewhere
  // send the request of wearables to load
  if (wearablesToAdd.length) {
    yield put(wearablesRequest({ wearableIds: wearablesToAdd }))
  }
}

// update the data on the currentDesiredPortableExperiences to include fetched runtime information
function* handleProcessWearables(action: ProcessWearablesAction) {
  const { payload } = action
  const currentDesiredPortableExperiences: Record<string, StorePortableExperience | null> = yield select(
    getDesiredWearablePortableExpriences
  )

  if (!(payload.wearable.id in currentDesiredPortableExperiences)) {
    yield put(addDesiredPortableExperience(payload.wearable.id, payload.wearable))
  }
}

// process all the received wearables and creates portable experiences definitions for them
function* handleWearablesSuccess(action: WearablesSuccess): any {
  const { wearables } = action.payload
  const wearablesToProcess = wearables.filter((w) =>
    w.data.representations.some((r) => r.contents.some((c) => c.key.endsWith('game.js')))
  )

  if (wearablesToProcess.length > 0) {
    const fetchContentServer: string = yield select(getFetchContentServer)

    for (const wearable of wearablesToProcess) {
      try {
        const baseUrl = wearable.baseUrl ?? fetchContentServer + '/contents/'

        // Get the wearable content containing the game.js
        const wearableContent = wearable.data.representations.filter((r) =>
          r.contents.some((c) => c.key.endsWith('game.js'))
        )[0].contents

        // In the deployment the content was replicated when the bodyShape selected was 'both'
        //  this add the prefix 'female/' or '/male' if they have more than one representations.
        // So, the scene (for now) is the same for both. We crop this prefix and keep the scene tree folder

        const femaleCrop =
          wearableContent.filter(($) => $.key.substr(0, 7) === 'female/').length === wearableContent.length
        const maleCrop = wearableContent.filter(($) => $.key.substr(0, 5) === 'male/').length === wearableContent.length

        const getFile = (key: string): string => {
          if (femaleCrop) return key.substring(7)
          if (maleCrop) return key.substring(5)
          return key
        }

        const mappings = wearableContent.map(($) => ({ file: getFile($.key), hash: $.hash }))
        const name = wearable.i18n[0].text

        const icon = 'smartWearableMenuBarIcon'
        mappings.push({ file: icon, hash: wearable.menuBarIcon ?? wearable.thumbnail })

        yield put(
          processWearables({
            id: wearable.id,
            parentCid: 'main',
            name,
            baseUrl,
            mappings,
            menuBarIcon: icon // TODO review
          })
        )
      } catch (e) {
        defaultLogger.log(e)
      }
    }
  }
}
