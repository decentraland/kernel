import { call, select, takeLatest } from 'redux-saga/effects'
import { realmToConnectionString } from 'shared/dao/utils/realmToString'
import { toEnvironmentRealmType } from '../apis/EnvironmentAPI'
import { SET_COMMS_ISLAND } from '../comms/actions'
import { getCommsIsland } from '../comms/selectors'
import { SET_CATALYST_REALM } from '../dao/actions'
import { getRealm } from '../dao/selectors'
import { Realm } from '../dao/types'
import { SaveProfileSuccess, SAVE_PROFILE_SUCCESS } from '../profiles/actions'
import { takeLatestByUserId } from '../profiles/sagas'
import { allScenesEvent } from '../world/parcelSceneManager'

export function* sceneEventsSaga() {
  yield takeLatest([SET_CATALYST_REALM, SET_COMMS_ISLAND], islandChanged)
  yield takeLatestByUserId(SAVE_PROFILE_SUCCESS, submitProfileToScenes)
}

function* islandChanged() {
  const realm: Realm = yield select(getRealm)
  const island: string | undefined = yield select(getCommsIsland)

  if (!realm) {
    return
  }

  const payload = toEnvironmentRealmType(realm, island)
  yield call(allScenesEvent, { eventType: 'onRealmChanged', payload })

  const realmString = realmToConnectionString(realm)
  yield call(updateLocation, realmString, island)
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

function* submitProfileToScenes(action: SaveProfileSuccess) {
  yield call(allScenesEvent, {
    eventType: 'profileChanged',
    payload: {
      ethAddress: action.payload.profile.ethAddress,
      version: action.payload.profile.version
    }
  })
}
