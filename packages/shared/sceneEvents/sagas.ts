import { Avatar } from '@dcl/schemas'
import { call, select, takeLatest, takeLeading } from 'redux-saga/effects'
import { rendererProtocol } from 'renderer-protocol/rpcClient'
import { realmToConnectionString } from 'shared/comms/v3/resolver'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { RENDERER_INITIALIZED_CORRECTLY } from 'shared/renderer/types'
import { toEnvironmentRealmType } from '../apis/host/EnvironmentAPI'
import { SET_COMMS_ISLAND, SET_WORLD_CONTEXT } from '../comms/actions'
import { getCommsIsland, getRealm } from '../comms/selectors'
import { Realm } from '../dao/types'
import { SAVE_PROFILE } from '../profiles/actions'
import { takeLatestByUserId } from '../profiles/sagas'
import { allScenesEvent, loadedSceneWorkers } from '../world/parcelSceneManager'

export function* sceneEventsSaga() {
  yield takeLatest([SET_COMMS_ISLAND, SET_WORLD_CONTEXT], islandChanged)
  yield takeLatestByUserId(SAVE_PROFILE, submitProfileToScenes)
  yield takeLeading(RENDERER_INITIALIZED_CORRECTLY, listenCrdtMessages)
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

function* listenCrdtMessages() {
  while (true) {
    console.log('pato: listenCrdtMessages')
    yield call(crdtNotificationListener)
    console.log('pato: listenCrdtMessages2')
  }
}

async function crdtNotificationListener() {
  const protocol = await rendererProtocol

  for await (const crdt of protocol.crdtService.cRDTNotificationStream({})) {
    const scene = loadedSceneWorkers.get(crdt.sceneId)
    scene?.rpcContext.sendCrdtMessage(crdt.payload)
    console.log(`pato: received crdt ${crdt.sceneId}`)
  }
}
