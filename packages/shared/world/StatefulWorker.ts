import { ParcelSceneAPI } from './ParcelSceneAPI'
import { SceneWorker } from './SceneWorker'
// import { SceneStateStorageController } from 'shared/apis/SceneStateStorageController/SceneStateStorageController'
// import { defaultLogger } from 'shared/logger'
// import { ParcelIdentity } from 'shared/apis/ParcelIdentity'
import { StatefulWorkerOptions } from './types'
import { Transport } from '@dcl/rpc'
import { WebWorkerTransport } from '@dcl/rpc/dist/transports/WebWorker'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const gamekitWorkerRaw = require('raw-loader!../../../static/systems/stateful.scene.system.js')
const gamekitWorkerBLOB = new Blob([gamekitWorkerRaw])
const gamekitWorkerUrl = URL.createObjectURL(gamekitWorkerBLOB)

export class StatefulWorker extends SceneWorker {
  constructor(parcelScene: ParcelSceneAPI, _options: StatefulWorkerOptions) {
    super(parcelScene, StatefulWorker.buildWebWorkerTransport(parcelScene))

    // todo: new rpc

    // this.getAPIInstance(SceneStateStorageController).catch((error) =>
    //   defaultLogger.error('Failed to load the SceneStateStorageController', error)
    // )
    // void this.getAPIInstance(ParcelIdentity).then((parcelIdentity) => (parcelIdentity.isEmpty = options.isEmpty))
  }

  private static buildWebWorkerTransport(parcelScene: ParcelSceneAPI): Transport {
    const worker = new Worker(gamekitWorkerUrl, {
      name: `StatefulWorker(${parcelScene.data.sceneId})`
    })

    return WebWorkerTransport(worker)
  }

  setPosition() {
    return
  }

  isPersistent(): boolean {
    return false
  }

  hasSceneStarted(): boolean {
    return true
  }

  protected childDispose() {
    return
  }
}
