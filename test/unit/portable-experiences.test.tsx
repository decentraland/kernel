import { expectSaga } from 'redux-saga-test-plan'
import { call, select } from 'redux-saga/effects'

import { portableExperienceSaga } from '../../packages/shared/portableExperiences/sagas'
import { addDebugPortableExperience, denyPortableExperiences } from 'shared/portableExperiences/actions'
import { StorePortableExperience } from 'shared/types'
import { getDebugPortableExperiences, getPortableExperienceDenyList, getPortableExperiencesCreatedByScenes } from 'shared/portableExperiences/selectors'
import { getDesiredLoadableWearablePortableExpriences } from 'shared/wearablesPortableExperience/selectors'
import { declareWantedPortableExperiences } from 'unity-interface/portableExperiencesUtils'
import { RootPortableExperiencesState } from 'shared/portableExperiences/types'
import { reducers } from 'shared/store/rootReducer'

describe('Portable experiences sagas test', () => {

  const createStorePX = (urn: string): StorePortableExperience => ({
    id: urn,
    baseUrl: '',
    mappings: [],
    menuBarIcon: 'icon',
    name: urn,
    parentCid: 'main'
  })

  it('empty scenario', () => {
    const action = addDebugPortableExperience(createStorePX('urn'))

    return expectSaga(portableExperienceSaga)
      .provide([
        [select(getPortableExperienceDenyList), []],
        [select(getDebugPortableExperiences), []],
        [select(getPortableExperiencesCreatedByScenes), []],
        [select(getDesiredLoadableWearablePortableExpriences), []],
        [call(declareWantedPortableExperiences, []), []]
      ])
      .dispatch(action)
      .run()
  })

  it('returning one PX in debug', () => {
    const px = createStorePX('urn')
    const action = addDebugPortableExperience(px)

    return expectSaga(portableExperienceSaga)
      .provide([
        [select(getPortableExperienceDenyList), []],
        [select(getDebugPortableExperiences), [px]],
        [select(getPortableExperiencesCreatedByScenes), []],
        [select(getDesiredLoadableWearablePortableExpriences), []],
        [call(declareWantedPortableExperiences, [px]), []]
      ])
      .dispatch(action)
      .run()
  })

  it('returning a PX multiple times should dedup the px', () => {
    const px1 = createStorePX('urn')
    const px2 = createStorePX('urn')
    const action = addDebugPortableExperience(px1)

    return expectSaga(portableExperienceSaga)
      .provide([
        [select(getPortableExperienceDenyList), []],
        [select(getDebugPortableExperiences), [px1, px2]],
        [select(getPortableExperiencesCreatedByScenes), [px1, px2]],
        [select(getDesiredLoadableWearablePortableExpriences), [px1]],
        [call(declareWantedPortableExperiences, [px1]), []]
      ])
      .call(declareWantedPortableExperiences, [px1])
      .dispatch(action)
      .run()
  })

  function state(theState: RootPortableExperiencesState): RootPortableExperiencesState {
    return Object.assign((reducers as any)(), theState)
  }

  describe('with reducer', () => {

    it('removing a PX from denylist should start it', () => {
      const pxOld = createStorePX('urn-old')
      const pxDenied = createStorePX('urn-denied')

      return expectSaga(portableExperienceSaga)
        .withReducer(reducers)
        .withState(state({
          portableExperiences: {
            deniedPortableExperiencesFromRenderer: ['urn-denied'],
            debugPortableExperiencesList: {
              [pxOld.id]: pxOld,
              [pxDenied.id]: pxDenied
            },
            portableExperiencesCreatedByScenesList: {}
          }
        }))
        .provide([[call(declareWantedPortableExperiences, [pxOld, pxDenied]), []]])
        .dispatch(denyPortableExperiences([]))
        .call(declareWantedPortableExperiences, [pxOld, pxDenied])
        .hasFinalState(state({
          portableExperiences: {
            deniedPortableExperiencesFromRenderer: [],
            debugPortableExperiencesList: {
              [pxOld.id]: pxOld,
              [pxDenied.id]: pxDenied
            },
            portableExperiencesCreatedByScenesList: {}
          }
        }))
        .run()
    })

    it('adding a denied PX should not trigger any action', () => {
      const pxOld = createStorePX('urn-old')
      const pxDenied = createStorePX('urn-denied')

      return expectSaga(portableExperienceSaga)
        .withReducer(reducers)
        .withState(state({
          portableExperiences: {
            deniedPortableExperiencesFromRenderer: ['urn-denied'],
            debugPortableExperiencesList: {
              [pxOld.id]: pxOld
            },
            portableExperiencesCreatedByScenesList: {}
          }
        }))
        .provide([[call(declareWantedPortableExperiences, [pxOld]), []]])
        .dispatch(addDebugPortableExperience(pxDenied))
        .call(declareWantedPortableExperiences, [pxOld])
        .hasFinalState(state({
          portableExperiences: {
            deniedPortableExperiencesFromRenderer: ['urn-denied'],
            debugPortableExperiencesList: {
              [pxOld.id]: pxOld,
              [pxDenied.id]: pxDenied
            },
            portableExperiencesCreatedByScenesList: {}
          }
        }))
        .run()
    })
  })


  describe('santi use case', async () => {
    const px = createStorePX('urn:decentraland:off-chain:static-portable-experiences:radio')


    // add debug px
    it('add the debug px', () => expectSaga(portableExperienceSaga)
      .withReducer(reducers)
      .withState(state({
        portableExperiences: {
          deniedPortableExperiencesFromRenderer: [],
          debugPortableExperiencesList: {},
          portableExperiencesCreatedByScenesList: {}
        }
      }))
      .provide([[call(declareWantedPortableExperiences, [px]), []]])
      .dispatch(addDebugPortableExperience(px))
      .call(declareWantedPortableExperiences, [px])
      .hasFinalState(state({
        portableExperiences: {
          deniedPortableExperiencesFromRenderer: [],
          debugPortableExperiencesList: {
            [px.id]: px,
          },
          portableExperiencesCreatedByScenesList: {}
        }
      }))
      .run())

    // deny list it
    it('add it to the denylist', () => expectSaga(portableExperienceSaga)
      .withReducer(reducers)
      .withState(state({
        portableExperiences: {
          deniedPortableExperiencesFromRenderer: [],
          debugPortableExperiencesList: {
            [px.id]: px,
          },
          portableExperiencesCreatedByScenesList: {}
        }
      }))
      .provide([[call(declareWantedPortableExperiences, []), []]])
      .dispatch(denyPortableExperiences([px.id]))
      .call(declareWantedPortableExperiences, [])
      .hasFinalState(state({
        portableExperiences: {
          deniedPortableExperiencesFromRenderer: [px.id],
          debugPortableExperiencesList: {
            [px.id]: px,
          },
          portableExperiencesCreatedByScenesList: {}
        }
      }))
      .run())


    // remove from deny list
    it('remove it from the denylist', () => expectSaga(portableExperienceSaga)
      .withReducer(reducers)
      .withState(state({
        portableExperiences: {
          deniedPortableExperiencesFromRenderer: [px.id],
          debugPortableExperiencesList: {
            [px.id]: px,
          },
          portableExperiencesCreatedByScenesList: {}
        }
      }))
      .provide([[call(declareWantedPortableExperiences, [px]), []]])
      .dispatch(denyPortableExperiences([]))
      .call(declareWantedPortableExperiences, [px])
      .hasFinalState(state({
        portableExperiences: {
          deniedPortableExperiencesFromRenderer: [],
          debugPortableExperiencesList: {
            [px.id]: px,
          },
          portableExperiencesCreatedByScenesList: {}
        }
      }))
      .run())
  })
})
