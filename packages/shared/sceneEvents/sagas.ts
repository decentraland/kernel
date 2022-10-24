import { Avatar } from '@dcl/schemas'
import { call, select, takeLatest } from 'redux-saga/effects'
import { SET_REALM_ADAPTER } from 'shared/realm/actions'
import { realmToConnectionString } from 'shared/realm/resolver'
import { getRealmAdapter } from 'shared/realm/selectors'
import { IRealmAdapter } from 'shared/realm/types'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { toEnvironmentRealmType } from '../apis/host/EnvironmentAPI'
import { SET_COMMS_ISLAND, SET_ROOM_CONNECTION } from '../comms/actions'
import { getCommsIsland } from '../comms/selectors'
import { SAVE_PROFILE } from '../profiles/actions'
import { takeLatestByUserId } from '../profiles/sagas'
import { allScenesEvent } from '../world/parcelSceneManager'

export function* sceneEventsSaga() {
  yield takeLatest([SET_COMMS_ISLAND, SET_ROOM_CONNECTION, SET_REALM_ADAPTER], islandChanged)
  yield takeLatestByUserId(SAVE_PROFILE, submitProfileToScenes)
}

function* islandChanged() {
  const adapter: IRealmAdapter | undefined = yield select(getRealmAdapter)
  const island: string | undefined = yield select(getCommsIsland)

  if (adapter) {
    const payload = toEnvironmentRealmType(adapter, island)
    yield call(allScenesEvent, { eventType: 'onRealmChanged', payload })
  }

  yield call(updateLocation, adapter ? realmToConnectionString(adapter) : undefined, island)
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
