import { expect } from 'chai';
import * as parcelSceneManager from 'shared/world/parcelSceneManager';
import {
  BuilderIsolatedPayload,
  IsolatedMode,
  IsolatedModeOptions,
} from 'shared/world/types';
import sinon from 'sinon';

function mockLifeCycle() {
  return {
    getParcelData: sinon.stub(),
    notify: sinon.stub(),
  } as any
}

function mockGetSceneWorkerBySceneID() {
  sinon
    .stub(parcelSceneManager, 'loadParcelSceneByIdIfMissing')
}

describe('parcelSceneManager', () => {
  it('StartIsolatedMode', () => {
     
    const sceneId = 'testSceneId'
    mockGetSceneWorkerBySceneID()
    parcelSceneManager.parcelSceneLoadingState.lifecycleManager =
      mockLifeCycle();
    console.log(parcelSceneManager.loadedSceneWorkers)
    console.log(parcelSceneManager.getSceneWorkerBySceneID)

    const parcels: Set<string> = new Set<string>()
    parcels.add(sceneId)

    const payload: BuilderIsolatedPayload = {
      sceneId: sceneId,
      recreateScene: false,
    };

    const options: IsolatedModeOptions<BuilderIsolatedPayload> = {
      mode: IsolatedMode.BUILDER,
      payload,
    };
    parcelSceneManager.startIsolatedMode(options);

    expect( parcelSceneManager.getDesiredParcelScenes()).to.eql(parcels);
  });

  it('SetDesiredParcelScenes', () => {
    const parcels: Set<string> = new Set<string>();

    parcelSceneManager.setDesiredParcelScenes(parcels);

    expect( parcelSceneManager.getDesiredParcelScenes()).to.eql(parcels);

    parcels.add('test');
    parcelSceneManager.setDesiredParcelScenes(parcels);

    expect( parcelSceneManager.getDesiredParcelScenes()).to.eql(parcels);

    parcels.delete('test');
    parcelSceneManager.setDesiredParcelScenes(parcels);

    expect( parcelSceneManager.getDesiredParcelScenes()).to.eql(parcels);
  });
});
