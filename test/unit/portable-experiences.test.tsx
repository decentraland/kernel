import { expectSaga } from 'redux-saga-test-plan'
import { call, select } from 'redux-saga/effects'

import { portableExperienceSaga } from '../../packages/shared/portableExperiences/sagas'
import {
  addScenePortableExperience,
  denyPortableExperiences,
  updateEnginePortableExperiences,
  removeScenePortableExperience,
  reloadScenePortableExperience,
  killAllPortableExperiences,
  activateAllPortableExperiences
} from 'shared/portableExperiences/actions'
import { StorePortableExperience } from 'shared/types'
import { getDesiredPortableExperiences } from 'shared/portableExperiences/selectors'
import { declareWantedPortableExperiences } from 'unity-interface/portableExperiencesUtils'
import { RootPortableExperiencesState } from 'shared/portableExperiences/types'
import { reducers } from 'shared/store/rootReducer'
import { expect } from 'chai'
import { EntityType } from '@dcl/schemas'

describe('Portable experiences sagas test', () => {
  const createStorePX = (urn: string): StorePortableExperience => ({
    parentCid: 'main',
    entity: {
      id: urn,
      baseUrl: '',
      content: [],
      metadata: {
        menuBarIcon: 'icon'
      },
      pointers: [],
      timestamp: 0,
      type: EntityType.SCENE,
      version: 'v3'
    }
  })

  it('empty scenario', () => {
    const action = addScenePortableExperience(createStorePX('urn'))

    return expectSaga(portableExperienceSaga)
      .provide([
        [select(getDesiredPortableExperiences), []],
        [call(declareWantedPortableExperiences, []), []]
      ])
      .dispatch(action)
      .put(updateEnginePortableExperiences([]))
      .run()
  })

  it('returning one PX in debug', () => {
    const px = createStorePX('urn')
    const action = addScenePortableExperience(px)

    return expectSaga(portableExperienceSaga)
      .provide([
        [select(getDesiredPortableExperiences), [px]],
        [call(declareWantedPortableExperiences, [px]), []]
      ])
      .dispatch(action)
      .put(updateEnginePortableExperiences([px]))
      .run()
  })

  it('reload PX', () => {
    const px = createStorePX('urn')
    const action = reloadScenePortableExperience(px)

    return expectSaga(portableExperienceSaga)
      .provide([
        [select(getDesiredPortableExperiences), [px]],
        [call(declareWantedPortableExperiences, []), []],
        [call(declareWantedPortableExperiences, [px]), []]
      ])
      .dispatch(action)
      .call(declareWantedPortableExperiences, [])
      .call(declareWantedPortableExperiences, [px])
      .run()
  })

  it('updateEnginePortableExperiences triggers a change in the engine (debounced)', () => {
    const px = createStorePX('urn')

    return expectSaga(portableExperienceSaga)
      .provide([[call(declareWantedPortableExperiences, [px]), []]])
      .dispatch(updateEnginePortableExperiences([])) // this one should not be triggered
      .dispatch(updateEnginePortableExperiences([px]))
      .not.call(declareWantedPortableExperiences, [])
      .call(declareWantedPortableExperiences, [px])
      .run()
  })

  it('returning a PX multiple times should dedup the px', () => {
    const px1 = createStorePX('urnA')
    const px2 = createStorePX('urnA')
    const px3 = createStorePX('urnB')

    const ret = getDesiredPortableExperiences({
      portableExperiences: {
        portableExperiencesCreatedByScenesList: {
          urnA: px1,
          urnB: px3
        },
        deniedPortableExperiencesFromRenderer: [],
        kernelPortableExperiences: {},
        globalPortalExperienceShutDown: false
      },
      wearablesPortableExperiences: {
        desiredWearablePortableExperiences: {
          urnA: px2
        }
      }
    })

    expect(ret).to.deep.eq([px1, px3])
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
        .withState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: ['urn-denied'],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {
                [pxOld.entity.id]: pxOld,
                [pxDenied.entity.id]: pxDenied
              },
              globalPortalExperienceShutDown: false
            }
          })
        )
        .provide([[call(declareWantedPortableExperiences, [pxOld, pxDenied]), []]])
        .dispatch(denyPortableExperiences([]))
        .call(declareWantedPortableExperiences, [pxOld, pxDenied])
        .hasFinalState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {
                [pxOld.entity.id]: pxOld,
                [pxDenied.entity.id]: pxDenied
              },
              globalPortalExperienceShutDown: false
            }
          })
        )
        .put(updateEnginePortableExperiences([pxOld, pxDenied]))
        .run()
    })

    it('adding a denied PX should not trigger any action', () => {
      const pxOld = createStorePX('urn-old')
      const pxDenied = createStorePX('urn-denied')

      return expectSaga(portableExperienceSaga)
        .withReducer(reducers)
        .withState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: ['urn-denied'],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {
                [pxOld.entity.id]: pxOld
              },
              globalPortalExperienceShutDown: false
            }
          })
        )
        .provide([[call(declareWantedPortableExperiences, [pxOld]), []]])
        .dispatch(addScenePortableExperience(pxDenied))
        .call(declareWantedPortableExperiences, [pxOld])
        .hasFinalState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: ['urn-denied'],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {
                [pxOld.entity.id]: pxOld,
                [pxDenied.entity.id]: pxDenied
              },
              globalPortalExperienceShutDown: false
            }
          })
        )
        .put(updateEnginePortableExperiences([pxOld]))
        .run()
    })

    it('removing a scene-created PX should remove it from the final list', () => {
      const pxOld = createStorePX('urn-old')

      return expectSaga(portableExperienceSaga)
        .withReducer(reducers)
        .withState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {
                [pxOld.entity.id]: pxOld
              },
              globalPortalExperienceShutDown: false
            }
          })
        )
        .provide([[call(declareWantedPortableExperiences, []), []]])
        .dispatch(removeScenePortableExperience(pxOld.entity.id))
        .call(declareWantedPortableExperiences, [])
        .hasFinalState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {},
              globalPortalExperienceShutDown: false
            }
          })
        )
        .put(updateEnginePortableExperiences([]))
        .run()
    })
  })

  describe('santi use case', async () => {
    const px = createStorePX('urn:decentraland:off-chain:static-portable-experiences:radio')

    // add debug px
    it('add the debug px, the desired PX should contain it', () =>
      expectSaga(portableExperienceSaga)
        .withReducer(reducers)
        .withState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {},
              globalPortalExperienceShutDown: false
            }
          })
        )
        .provide([[call(declareWantedPortableExperiences, [px]), []]])
        .dispatch(addScenePortableExperience(px))
        .call(declareWantedPortableExperiences, [px])
        .hasFinalState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {
                [px.entity.id]: px
              },
              globalPortalExperienceShutDown: false
            }
          })
        )
        .put(updateEnginePortableExperiences([px]))
        .run())

    // deny list it
    it('add it to the denylist, now the desired PX should be an empty list', () =>
      expectSaga(portableExperienceSaga)
        .withReducer(reducers)
        .withState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {
                [px.entity.id]: px
              },
              globalPortalExperienceShutDown: false
            }
          })
        )
        .provide([[call(declareWantedPortableExperiences, []), []]])
        .dispatch(denyPortableExperiences([px.entity.id]))
        .call(declareWantedPortableExperiences, [])
        .hasFinalState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [px.entity.id],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {
                [px.entity.id]: px
              },
              globalPortalExperienceShutDown: false
            }
          })
        )
        .put(updateEnginePortableExperiences([]))
        .run())

    // remove from deny list
    it('remove it from the denylist, the desired PX should include the allowed PX', () =>
      expectSaga(portableExperienceSaga)
        .withReducer(reducers)
        .withState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [px.entity.id],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {
                [px.entity.id]: px
              },
              globalPortalExperienceShutDown: false
            }
          })
        )
        .provide([[call(declareWantedPortableExperiences, [px]), []]])
        .dispatch(denyPortableExperiences([]))
        .call(declareWantedPortableExperiences, [px])
        .hasFinalState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {
                [px.entity.id]: px
              },
              globalPortalExperienceShutDown: false
            }
          })
        )
        .put(updateEnginePortableExperiences([px]))
        .run())

    it('shutdown the PX, this should shutdown all the PX', () =>
      expectSaga(portableExperienceSaga)
        .withReducer(reducers)
        .withState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {
                [px.entity.id]: px
              },
              globalPortalExperienceShutDown: false
            }
          })
        )
        .dispatch(killAllPortableExperiences())
        .hasFinalState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {
                [px.entity.id]: px
              },
              globalPortalExperienceShutDown: true
            }
          })
        )
        .run())

    it('activate the PX, this should activate all the PX that has been shutdown', () =>
      expectSaga(portableExperienceSaga)
        .withReducer(reducers)
        .withState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {},
              globalPortalExperienceShutDown: true
            }
          })
        )
        .dispatch(activateAllPortableExperiences())
        .hasFinalState(
          state({
            portableExperiences: {
              deniedPortableExperiencesFromRenderer: [],
              kernelPortableExperiences: {},
              portableExperiencesCreatedByScenesList: {},
              globalPortalExperienceShutDown: false
            }
          })
        )
        .run())
  })
})
