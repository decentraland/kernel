import sinon from 'sinon'
import { expect } from 'chai'

import * as store from 'shared/store/isolatedStore'
import {
  getDesiredParcelScenes,
  loadedSceneWorkers,
  parcelSceneLoadingState,
  setBuilderLastKnownPlayerPosition,
  startIsolatedMode,
  stopIsolatedMode
} from 'shared/world/parcelSceneManager'
import { BuilderIsolatedPayload, IsolatedMode, IsolatedModeOptions } from 'shared/world/types'
import { LifecycleManager } from 'decentraland-loader/lifecycle/manager'

function mockLifeCycle() {
  sinon.restore()
  sinon.reset()
  parcelSceneLoadingState.lifecycleManager = {
    getParcelData: sinon.stub().returns({}),
    setParcelData: sinon.stub(),
    notify: sinon.stub() as any
  } as Partial<LifecycleManager> as LifecycleManager
}

const land = {
  sceneId: 'testSceneId',
  sceneJsonData: {},
  baseUrl: 'baseUrl',
  baseUrlBundles: 'string',
  mappingsResponse: {
    parcel_id: 'string',
    root_cid: 'string',
    contents: []
  }
}

afterEach(() => {
  sinon.restore()
  loadedSceneWorkers.clear()
})

describe('Parcel scene manager', () => {
  it('start isolated mode without loaded scenes', () => {
    mockLifeCycle()
    const sceneId = 'testSceneId'

    // Mock load scene worker so we dont need to lead with a webWorker loading
    loadedSceneWorkers.set(sceneId, {} as any)

    const parcels: Set<string> = new Set<string>([sceneId])
    const options: IsolatedModeOptions<BuilderIsolatedPayload> = {
      mode: IsolatedMode.BUILDER,
      payload: {
        sceneId: sceneId,
        land: land as any,
        recreateScene: false
      }
    }
    startIsolatedMode(options)
    expect(getDesiredParcelScenes()).to.eql(parcels)
  })

  it('start isolated mode loaded scenes', () => {
    mockLifeCycle()
    const sceneId = 'testSceneId'
    const previousScenes = new Set(['old-scene'])
    parcelSceneLoadingState.desiredParcelScenes = previousScenes
    // Mock load scene worker so we dont need to lead with a webWorker loading
    loadedSceneWorkers.set(sceneId, {} as any)

    const parcels: Set<string> = new Set<string>([sceneId])
    const options: IsolatedModeOptions<BuilderIsolatedPayload> = {
      mode: IsolatedMode.BUILDER,
      payload: {
        sceneId: sceneId,
        land: land as any,
        recreateScene: false
      }
    }
    startIsolatedMode(options)
    expect(Array.from(getDesiredParcelScenes())).deep.eq(Array.from(parcels))
    expect(parcelSceneLoadingState.runningIsolatedMode).to.eq(true)
  })

  it('stop isolated mode loaded scenes', () => {
    mockLifeCycle()

    const sceneId = 'testSceneId'
    // Mock load scene worker so we dont need to lead with a webWorker loading
    loadedSceneWorkers.set(sceneId, { isPersistent: () => true } as any)
    store.setStore({ dispatch: () => {} } as any)
    setBuilderLastKnownPlayerPosition({ x: 0, y: 0 })
    const options: IsolatedModeOptions<BuilderIsolatedPayload> = {
      mode: IsolatedMode.BUILDER,
      payload: {
        sceneId: sceneId,
        land: land as any,
        recreateScene: false
      }
    }

    startIsolatedMode(options)
    stopIsolatedMode({ ...options, payload: { ...options.payload, sceneId: undefined } })

    expect(getDesiredParcelScenes()).to.deep.eq(new Set())
    expect(parcelSceneLoadingState.runningIsolatedMode).to.eq(false)
  })
})
