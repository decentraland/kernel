import { call, select, takeEvery } from 'redux-saga/effects'
import {
  ADD_DESIRED_PORTABLE_EXPERIENCE,
  REMOVE_DESIRED_PORTABLE_EXPERIENCE
} from 'shared/wearablesPortableExperience/actions'
import { getDesiredWearablePortableExpriences } from 'shared/wearablesPortableExperience/selectors'
import {
  getRunningPortableExperience,
  spawnPortableExperience,
  StorePortableExperience,
  unloadExtraPortableExperiences
} from 'unity-interface/portableExperiencesUtils'
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
    // ADD HERE ALL THE SOURCES OF DIFFERENT PORTABLE EXPERIENCES
    // ...(yield select(getOnboardingPortableExperiences)),
    // ...(yield select(getSceneCreatedPortableExperiences)),
    // ...(yield select(getManuallyOpenPortableExperiences)),
    ...(yield select(getDesiredWearablePortableExpriences))
  ]

  const allFilteredPortableExperiences = allDesiredPortableExperiences.filter(($) => !denylist.includes($.id))

  // first unload all the extra scenes
  const allDesiredIds = allFilteredPortableExperiences.map(($) => $.id)
  yield call(unloadExtraPortableExperiences, allDesiredIds)

  // then load all the missing scenes
  for (const sceneData of allFilteredPortableExperiences) {
    if (!getRunningPortableExperience(sceneData.id)) {
      spawnPortableExperience(sceneData)
    }
  }
}
