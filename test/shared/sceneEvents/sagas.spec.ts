import { expectSaga } from 'redux-saga-test-plan'
// import * as matchers from 'redux-saga-test-plan/matchers'
import { select } from 'redux-saga/effects'
import { setCommsIsland } from '../../../packages/shared/comms/actions'

import { getCommsIsland } from '../../../packages/shared/comms/selectors'
import { setCatalystRealm } from '../../../packages/shared/dao/actions'
import { getRealm } from '../../../packages/shared/dao/selectors'
import { saveProfileSuccess } from '../../../packages/shared/profiles/actions'
import { sceneEventsSaga } from '../../../packages/shared/sceneEvents/sagas'
import { Profile } from '../../../packages/shared/types'
import { allScenesEvent } from '../../../packages/shared/world/parcelSceneManager'

const realm = {
  domain: 'realm-domain',
  catalystName: 'catalyst-name',
  lighthouseVersion: 'string',
}
const toRealmType = (island: string) => ({
  domain: realm.domain,
  layer: island,
  room: island,
  serverName: realm.catalystName,
  displayName: `${realm.catalystName}-${island}`,
})

describe('when the realm change: SET_CATALYST_REALM', () => {
  it('should call allScene events withuot island', () => {
    const action = setCatalystRealm(realm)
    const island = ''
    return expectSaga(sceneEventsSaga)
      .provide([
        [select(getCommsIsland), null],
      ])
      .call(allScenesEvent, { eventType: 'onRealmChanged', payload: toRealmType(island) })
      .dispatch(action)
      .run()
  })

  it('should call allScene events fn with the specified realm & island', () => {
    const island = 'casla-island'
    const action = setCatalystRealm(realm)

    return expectSaga(sceneEventsSaga)
      .provide([
        [select(getCommsIsland), island],
      ])
      .call(allScenesEvent, { eventType: 'onRealmChanged', payload: toRealmType(island) })
      .dispatch(action)
      .run()
  })
})

describe('when the island change: SET_COMMS_ISLAND', () => {
  it('should NOT call allScene events since the realm is null', () => {
    const action = setCommsIsland('caddla-island')
    return expectSaga(sceneEventsSaga)
      .provide([
        [select(getRealm), null],
      ])
      .not.call.fn(allScenesEvent)
      .dispatch(action)
      .run()
  })

  it('should call allScene events fn with the specified realm & island', () => {
    const island = 'casla-island'
    const action = setCommsIsland(island)

    return expectSaga(sceneEventsSaga)
      .provide([
        [select(getRealm), realm],
      ])
      .call(allScenesEvent, { eventType: 'onRealmChanged', payload: toRealmType(island) })
      .dispatch(action)
      .run()
  })
})

describe('when the profile updates successfully: SAVE_PROFILE_SUCCESS', () => {
  it('should call allScene events with profileChanged', () => {
    const userId = 'user-id'
    const version = 8
    const profile: Profile = {
      version,
      ethAddress: 'eth-address'
    } as any as Profile
    const action = saveProfileSuccess(userId, version, profile)
    const payload = {
      ethAddress: 'eth-address',
      version: 8
    }
    return expectSaga(sceneEventsSaga)
      .provide([
        [select(getRealm), realm],
      ])
      .call(allScenesEvent, { eventType: 'profileChanged', payload })
      .dispatch(action)
      .run()
  })
})
