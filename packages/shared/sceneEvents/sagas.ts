import { Avatar } from '@dcl/schemas'
import { call, select, takeLatest } from 'redux-saga/effects'
import { SET_BFF } from 'shared/bff/actions'
import { realmToConnectionString } from 'shared/bff/resolver'
import { getBff } from 'shared/bff/selectors'
import { IBff } from 'shared/bff/types'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { toEnvironmentRealmType } from '../apis/host/EnvironmentAPI'
import { SET_COMMS_ISLAND, SET_WORLD_CONTEXT } from '../comms/actions'
import { getCommsIsland } from '../comms/selectors'
import { SAVE_PROFILE } from '../profiles/actions'
import { takeLatestByUserId } from '../profiles/sagas'
import { allScenesEvent } from '../world/parcelSceneManager'

export function* sceneEventsSaga() {
  yield takeLatest([SET_COMMS_ISLAND, SET_WORLD_CONTEXT, SET_BFF], islandChanged)
  yield takeLatestByUserId(SAVE_PROFILE, submitProfileToScenes)
}

function* islandChanged() {
  const realm: IBff | undefined = yield select(getBff)
  const island: string | undefined = yield select(getCommsIsland)

  if (realm) {
    const payload = toEnvironmentRealmType(realm, island)
    yield call(allScenesEvent, { eventType: 'onRealmChanged', payload })
  }

  yield call(updateLocation, realm ? realmToConnectionString(realm) : undefined, island)
}

// @internal
export function updateLocation(realm: string | undefined, island: string | undefined) {
  const q = new URLSearchParams(window.location.search)
  if (realm) q.set('realm', realm)
  else q.delete('realm')
  if (island) {
    q.set('island', island)
  } else {
    q.delete('island')
  }
  history.replaceState({ island, realm }, '', `?${q.toString()}`)
}

function* submitProfileToScenes() {
  const profile: Avatar | null = yield select(getCurrentUserProfile)
  if (profile) {
    yield call(allScenesEvent, {
      eventType: 'profileChanged',
      payload: {
        ethAddress: profile.ethAddress,
        version: profile.version
      }
    })
  }
}
