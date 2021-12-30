import sinon from 'sinon'
import { expect } from 'chai'

import * as store from 'shared/store/isolatedStore'
import * as parcelSceneManager from 'shared/world/parcelSceneManager'
import {
  BuilderIsolatedPayload,
  IsolatedMode,
  IsolatedModeOptions,
} from 'shared/world/types'

function mockLifeCycle() {
  const lifeCycleManager = {
    getParcelData: sinon.stub(),
    notify: sinon.stub(),
    setParcelData: sinon.stub()
  } as any
  parcelSceneManager.parcelSceneLoadingState.lifecycleManager = lifeCycleManager
}

export function mockGetSceneWorkerBySceneID() {
  return sinon.stub(parcelSceneManager, 'loadParcelSceneByIdIfMissing').callsFake(async() => {})
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
  parcelSceneManager.loadedSceneWorkers.clear()
})

describe('Parcel scene manager', () => {
  it('start isolated mode without loaded scenes', () => {
    mockLifeCycle()
    const sceneId = 'testSceneId'

    // Mock load scene worker so we dont need to lead with a webWorker loading
    parcelSceneManager.loadedSceneWorkers.set(sceneId, {} as any)

    const parcels: Set<string> = new Set<string>([sceneId])
    const options: IsolatedModeOptions<BuilderIsolatedPayload> = {
      mode: IsolatedMode.BUILDER,
      payload: {
        sceneId: sceneId,
        land: land as any,
        recreateScene: false,
      },
    }
    parcelSceneManager.startIsolatedMode(options)
    expect(parcelSceneManager.getDesiredParcelScenes()).to.eql(parcels)
  })

  it('start isolated mode loaded scenes', () => {
    mockLifeCycle()
    const sceneId = 'testSceneId'
    const previousScenes = new Set(['old-scene'])
    parcelSceneManager.parcelSceneLoadingState.desiredParcelScenes = previousScenes
    // Mock load scene worker so we dont need to lead with a webWorker loading
    parcelSceneManager.loadedSceneWorkers.set(sceneId, {} as any)

    const parcels: Set<string> = new Set<string>([sceneId])
    const options: IsolatedModeOptions<BuilderIsolatedPayload> = {
      mode: IsolatedMode.BUILDER,
      payload: {
        sceneId: sceneId,
        land: land as any,
        recreateScene: false,
      },
    }
    parcelSceneManager.startIsolatedMode(options)
    expect(parcelSceneManager.getDesiredParcelScenes()).to.eql(parcels)
    expect(parcelSceneManager.parcelSceneLoadingState.runningIsolatedMode).to.eq(true)
  })
  it('stop isolated mode loaded scenes', () => {
    mockLifeCycle()

    const sceneId = 'testSceneId'
    // Mock load scene worker so we dont need to lead with a webWorker loading
    parcelSceneManager.loadedSceneWorkers.set(sceneId, ({ isPersistent: () => true}) as any)
    store.setStore({ dispatch: (() => {}) } as any)
    parcelSceneManager.setPlayerPosition({ x: 0, y: 0 })
    const options: IsolatedModeOptions<BuilderIsolatedPayload> = {
      mode: IsolatedMode.BUILDER,
      payload: {
        sceneId: sceneId,
        land: land as any,
        recreateScene: false,
      },
    }
    parcelSceneManager.startIsolatedMode(options)
    parcelSceneManager.stopIsolatedMode({...options, payload: { ...options.payload, sceneId: undefined } })
    expect(parcelSceneManager.getDesiredParcelScenes()).to.eql(new Set())
    expect(parcelSceneManager.parcelSceneLoadingState.runningIsolatedMode).to.eq(false)
  })

  it('Set desired parcels scene', () => {
    const parcels: Set<string> = new Set<string>()
    parcelSceneManager.setDesiredParcelScenes(parcels)
    expect(parcelSceneManager.getDesiredParcelScenes()).to.eql(parcels)

    parcels.add('test')
    parcelSceneManager.setDesiredParcelScenes(parcels)
    expect(parcelSceneManager.getDesiredParcelScenes()).to.eql(parcels)

    parcels.delete('test')
    parcelSceneManager.setDesiredParcelScenes(parcels)

    expect(parcelSceneManager.getDesiredParcelScenes()).to.eql(parcels)
  })
})
