import { call, select, takeEvery } from 'redux-saga/effects'
import { StorePortableExperience } from 'shared/types'
import {
  ADD_DESIRED_PORTABLE_EXPERIENCE,
  REMOVE_DESIRED_PORTABLE_EXPERIENCE
} from 'shared/wearablesPortableExperience/actions'
import { getDesiredLoadableWearablePortableExpriences } from 'shared/wearablesPortableExperience/selectors'
import { declareWantedPortableExperiences } from 'unity-interface/portableExperiencesUtils'
import { ADD_DEBUG_PX, DENY_PORTABLE_EXPERIENCES, REMOVE_DEBUG_PX } from './actions'
import {
  getDebugPortableExperiences,
  getPortableExperienceDenyList,
  getPortableExperiencesCreatedByScenes
} from './selectors'

export function* portableExperienceSaga(): any {
  yield takeEvery(REMOVE_DESIRED_PORTABLE_EXPERIENCE, handlePortableExperienceChanges)
  yield takeEvery(ADD_DESIRED_PORTABLE_EXPERIENCE, handlePortableExperienceChanges)
  yield takeEvery(DENY_PORTABLE_EXPERIENCES, handlePortableExperienceChanges)
  yield takeEvery(ADD_DEBUG_PX, handlePortableExperienceChanges)
  yield takeEvery(REMOVE_DEBUG_PX, handlePortableExperienceChanges)
}

function* handlePortableExperienceChanges(): any {
  const denylist: string[] = yield select(getPortableExperienceDenyList)

  const allDesiredPortableExperiences: StorePortableExperience[] = dedup(
    [
      // ADD HERE ALL THE SOURCES OF DIFFERENT PORTABLE EXPERIENCES TO BE HANDLED BY KERNEL
      // ...(yield select(getOnboardingPortableExperiences)),
      // ...(yield select(getSceneCreatedPortableExperiences)),
      // ...(yield select(getManuallyOpenPortableExperiences)),
      ...(yield select(getDebugPortableExperiences)),
      ...(yield select(getPortableExperiencesCreatedByScenes)),
      ...(yield select(getDesiredLoadableWearablePortableExpriences))
    ],
    (x) => x.id
  )

  const allFilteredPortableExperiences = allDesiredPortableExperiences.filter(($) => !denylist.includes($.id))

  // tell the controller which PXs we do want running
  yield call(declareWantedPortableExperiences, allFilteredPortableExperiences)
}

function dedup<T>(array: T[], filter: (param: T) => any): T[] {
  const map = new Map<any, T>()
  for (const elem of array) {
    const key = filter(elem)
    if (map.has(key)) continue
    map.set(key, elem)
  }
  return Array.from(map.values())
}
