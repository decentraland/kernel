import { EntityV3Asset, parseUrn, resolveUrlFromUrn } from '@dcl/urn-resolver'
import { call, takeEvery, debounce, select, put, fork } from 'redux-saga/effects'
import { trackEvent } from 'shared/analytics'
import { getFetchContentServer } from 'shared/dao/selectors'
import { waitForMetaConfigurationInitialization } from 'shared/meta/sagas'
import { getFeatureFlagVariantValue } from 'shared/meta/selectors'
import { StorePortableExperience } from 'shared/types'
import { Entity } from 'dcl-catalyst-commons'
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
  UPDATE_ENGINE_PX,
  SHUTDOWN_ALL_PORTABLE_EXPERIENCES,
  ACTIVATE_ALL_PORTABLE_EXPERIENCES,
  ADD_KERNEL_PX,
  addKernelPortableExperience
} from './actions'
import { getDesiredPortableExperiences } from './selectors'

export function* portableExperienceSaga(): any {
  yield takeEvery(REMOVE_DESIRED_PORTABLE_EXPERIENCE, handlePortableExperienceChanges)
  yield takeEvery(ADD_DESIRED_PORTABLE_EXPERIENCE, handlePortableExperienceChanges)
  yield takeEvery(SHUTDOWN_ALL_PORTABLE_EXPERIENCES, handlePortableExperienceChanges)
  yield takeEvery(ACTIVATE_ALL_PORTABLE_EXPERIENCES, handlePortableExperienceChanges)
  yield takeEvery(DENY_PORTABLE_EXPERIENCES, handlePortableExperienceChanges)
  yield takeEvery(ADD_SCENE_PX, handlePortableExperienceChanges)
  yield takeEvery(ADD_KERNEL_PX, handlePortableExperienceChanges)
  yield takeEvery(REMOVE_SCENE_PX, handlePortableExperienceChanges)
  yield takeEvery(RELOAD_SCENE_PX, reloadPortableExperienceChanges)
  yield debounce(100 /* ms */, UPDATE_ENGINE_PX, handlePortableExperienceChangesEffect)

  yield fork(fetchInitialPortableExperiences)
}

function* fetchInitialPortableExperiences() {
  yield waitForMetaConfigurationInitialization()

  const qs = new URLSearchParams(globalThis.location.search)

  const variants: string[] = qs.has('GLOBAL_PX')
    ? qs.getAll('GLOBAL_PX')
    : yield select(getFeatureFlagVariantValue, 'initial_portable_experiences')

  try {
    if (Array.isArray(variants)) {
      for (const id of variants) {
        const parsedUrn: EntityV3Asset = yield parseUrn(id)
        if (parsedUrn) {
          const url: string = yield call(resolveUrlFromUrn, id)
          try {
            if (url) {
              const result = yield fetch(url)
              const json: Entity = yield result.json()

              const mappings = json.content || []

              const px: StorePortableExperience = {
                id,
                baseUrl: parsedUrn.baseUrl || (yield select(getFetchContentServer)),
                mappings,
                menuBarIcon: json.metadata.menuBarIcon || '',
                name: json.metadata?.display?.title || 'Unnamed',
                parentCid: 'main'
              }

              yield put(addKernelPortableExperience(px))
            }
          } catch (err: any) {
            console.error(err)
            trackEvent('error', {
              context: 'fetchInitialPortableExperiences',
              message: err.message,
              stack: err.stack
            })
          }
        }
      }
    }
  } catch (err: any) {
    console.error(err)
    trackEvent('error', {
      context: 'fetchInitialPortableExperiences',
      message: err.message,
      stack: err.stack
    })
  }
}

// every time the desired portable experiences change, the action `updateEnginePortableExperiences` should be dispatched
function* handlePortableExperienceChanges() {
  const desiredPortableExperiences = yield select(getDesiredPortableExperiences)
  yield put(updateEnginePortableExperiences(desiredPortableExperiences))
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
