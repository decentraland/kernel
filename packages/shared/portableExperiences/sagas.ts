import { call, select, takeEvery } from 'redux-saga/effects'
import { StorePortableExperience } from 'shared/types'
import {
  ADD_DESIRED_PORTABLE_EXPERIENCE,
  REMOVE_DESIRED_PORTABLE_EXPERIENCE
} from 'shared/wearablesPortableExperience/actions'
import { getDesiredLoadableWearablePortableExpriences } from 'shared/wearablesPortableExperience/selectors'
import { declareWantedPortableExperiences } from 'unity-interface/portableExperiencesUtils'
import { DENY_PORTABLE_EXPERIENCES } from './actions'
import { getPortableExperienceDenyList } from './selectors'

export function* portableExperienceSaga(): any {
  yield takeEvery(REMOVE_DESIRED_PORTABLE_EXPERIENCE, handlePortableExperienceChanges)
  yield takeEvery(ADD_DESIRED_PORTABLE_EXPERIENCE, handlePortableExperienceChanges)
  yield takeEvery(DENY_PORTABLE_EXPERIENCES, handlePortableExperienceChanges)
}

function* handlePortableExperienceChanges(): any {
  const denylist: string[] = yield select(getPortableExperienceDenyList)

  const allDesiredPortableExperiences: StorePortableExperience[] = [
    // ADD HERE ALL THE SOURCES OF DIFFERENT PORTABLE EXPERIENCES TO BE HANDLED BY KERNEL
    // ...(yield select(getOnboardingPortableExperiences)),
    // ...(yield select(getSceneCreatedPortableExperiences)),
    // ...(yield select(getManuallyOpenPortableExperiences)),
    ...(yield select(getDesiredLoadableWearablePortableExpriences))
  ]

  const allFilteredPortableExperiences = allDesiredPortableExperiences.filter(($) => !denylist.includes($.id))

  // tell the controller which PXs we do want running
  yield call(declareWantedPortableExperiences, allFilteredPortableExperiences)
}
