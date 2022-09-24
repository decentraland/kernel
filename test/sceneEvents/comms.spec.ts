import { expectSaga } from 'redux-saga-test-plan'
import { select } from 'redux-saga/effects'
import { toEnvironmentRealmType } from 'shared/apis/host/EnvironmentAPI'
import { setBff } from 'shared/bff/actions'
import { realmToConnectionString } from 'shared/bff/resolver'
import { IBff } from 'shared/bff/types'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { reducers } from 'shared/store/rootReducer'
import { setCommsIsland } from '../../packages/shared/comms/actions'
import { getCommsIsland } from '../../packages/shared/comms/selectors'
import { saveProfileDelta } from '../../packages/shared/profiles/actions'
import { sceneEventsSaga, updateLocation } from '../../packages/shared/sceneEvents/sagas'
import { allScenesEvent } from '../../packages/shared/world/parcelSceneManager'

const bff: IBff = {
  about: null as any
} as any

describe('when the realm change: SET_WORLD_CONTEXT', () => {
  it('should call allScene events with empty string island', () => {
    const action = setBff(bff)
    const island = ''
    return expectSaga(sceneEventsSaga)
      .provide([
        // [select(getRealm), realm],
        [select(getCommsIsland), island]
      ])
      .dispatch(action)
      .call(allScenesEvent, { eventType: 'onRealmChanged', payload: toEnvironmentRealmType(bff, island) })
      .call(updateLocation, realmToConnectionString(bff), island)
      .run()
  })

  it('should call allScene events with null island', () => {
    const action = setBff(bff)
    const island = undefined
    return expectSaga(sceneEventsSaga)
      .provide([
        // [select(getRealm), realm],
        [select(getCommsIsland), island]
      ])
      .dispatch(action)
      .call(allScenesEvent, { eventType: 'onRealmChanged', payload: toEnvironmentRealmType(bff, island) })
      .call(updateLocation, realmToConnectionString(bff), island)
      .run()
  })

  it('should call allScene events fn with the specified realm & island', () => {
    const island = 'casla-island'
    const action = setBff(bff)

    return expectSaga(sceneEventsSaga)
      .provide([
        // [select(getRealm), realm],
        [select(getCommsIsland), island]
      ])
      .dispatch(action)
      .call(allScenesEvent, { eventType: 'onRealmChanged', payload: toEnvironmentRealmType(bff, island) })
      .call(updateLocation, realmToConnectionString(bff), island)
      .run()
  })
})

describe('when the island change: SET_COMMS_ISLAND', () => {
  it('should NOT call allScene events since the realm is null', () => {
    const action = setCommsIsland('caddla-island')
    return expectSaga(sceneEventsSaga)
      // .provide([[select(getRealm), null]])
      .withReducer(reducers)
      .dispatch(action)
      .not.call.fn(allScenesEvent)
      .not.call.fn(updateLocation)
      .run()
  })

  it('should call allScene events fn with the specified realm & island', () => {
    const island = 'casla-island'
    const action = setCommsIsland(island)

    return expectSaga(sceneEventsSaga)
      // .provide([[select(getRealm), realm]])
      .withReducer(reducers)
      .dispatch(action)
      .call(allScenesEvent, { eventType: 'onRealmChanged', payload: toEnvironmentRealmType(bff, island) })
      .call(updateLocation, realmToConnectionString(bff), island)
      .run()
  })
})

describe('when the profile updates successfully: SAVE_PROFILE_SUCCESS', () => {
  it('should call allScene events with profileChanged using information from getCurrentUserProfile', () => {
    const userId = 'user-id'
    const action = saveProfileDelta({ userId })
    const payload = {
      ethAddress: 'eth-address',
      version: 8
    }
    return expectSaga(sceneEventsSaga)
      .provide([[select(getCurrentUserProfile), payload]])
      .dispatch(action)
      .call(allScenesEvent, { eventType: 'profileChanged', payload })
      .run()
  })
})
