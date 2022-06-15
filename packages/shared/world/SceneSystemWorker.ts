import { Quaternion, Vector3 } from '@dcl/ecs-math'

import { playerConfigurations } from 'config'
import { SceneWorker } from './SceneWorker'
import { PositionReport, positionObservable } from './positionThings'
import { Observer } from 'mz-observable'
import { sceneLifeCycleObservable } from '../../decentraland-loader/lifecycle/controllers/scene'
import { renderStateObservable } from './worldState'
import { ParcelSceneAPI } from './ParcelSceneAPI'
import { sceneObservable } from 'shared/world/sceneState'
import { getCurrentUserId } from 'shared/session/selectors'
import { store } from 'shared/store/isolatedStore'

import { Transport } from '@dcl/rpc'
import { WebWorkerTransport } from '@dcl/rpc/dist/transports/WebWorker'
import { EventDataType } from 'shared/apis/proto/EngineAPI.gen'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const gamekitWorkerRaw = require('raw-loader!../../../static/systems/scene.system.js')
const gamekitWorkerBLOB = new Blob([gamekitWorkerRaw])
const gamekitWorkerUrl = URL.createObjectURL(gamekitWorkerBLOB)

export class SceneSystemWorker extends SceneWorker {
  private sceneStarted: boolean = false

  private position!: Vector3
  private readonly lastSentPosition = new Vector3(0, 0, 0)
  private readonly lastSentRotation = new Quaternion(0, 0, 0, 1)
  private positionObserver: Observer<any> | null = null
  private sceneLifeCycleObserver: Observer<any> | null = null
  private renderStateObserver: Observer<any> | null = null
  private sceneChangeObserver: Observer<any> | null = null

  private sceneReady: boolean = false

  constructor(parcelScene: ParcelSceneAPI, transport?: Transport, private readonly persistent: boolean = false) {
    super(parcelScene, transport ?? SceneSystemWorker.buildWebWorkerTransport(parcelScene))

    this.subscribeToSceneLifeCycleEvents()
    this.subscribeToWorldRunningEvents()
    this.subscribeToPositionEvents()
    this.subscribeToSceneChangeEvents()
  }

  private static buildWebWorkerTransport(parcelScene: ParcelSceneAPI): Transport {
    const worker = new Worker(gamekitWorkerUrl, {
      name: `ParcelSceneWorker(${parcelScene.data.sceneId})`
    })

    return WebWorkerTransport(worker)
  }

  setPosition(position: Vector3) {
    // This method is called before position is reported by the renderer
    if (!this.position) {
      this.position = new Vector3()
    }
    this.position.copyFrom(position)
  }
  isPersistent(): boolean {
    return this.persistent
  }

  hasSceneStarted(): boolean {
    return this.sceneStarted
  }

  protected childDispose() {
    if (this.positionObserver) {
      positionObservable.remove(this.positionObserver)
      this.positionObserver = null
    }
    if (this.sceneLifeCycleObserver) {
      sceneLifeCycleObservable.remove(this.sceneLifeCycleObserver)
      this.sceneLifeCycleObserver = null
    }
    if (this.renderStateObserver) {
      renderStateObservable.remove(this.renderStateObserver)
      this.renderStateObserver = null
    }
    if (this.sceneChangeObserver) {
      sceneObservable.remove(this.sceneChangeObserver)
      this.sceneChangeObserver = null
    }
  }

  private sendUserViewMatrix(positionReport: Readonly<PositionReport>) {
    if (this.rpcContext?.EngineAPI && 'positionChanged' in this.rpcContext.EngineAPI.subscribedEvents) {
      if (!this.lastSentPosition.equals(positionReport.position)) {
        this.rpcContext.sendProtoSceneEvent({
          type: EventDataType.PositionChanged,
          positionChanged: {
            position: {
              x: positionReport.position.x - this.position.x,
              z: positionReport.position.z - this.position.z,
              y: positionReport.position.y
            },
            cameraPosition: positionReport.position,
            playerHeight: playerConfigurations.height
          }
        })

        this.lastSentPosition.copyFrom(positionReport.position)
      }
    }
    if (this.rpcContext.EngineAPI && 'rotationChanged' in this.rpcContext.EngineAPI.subscribedEvents) {
      if (positionReport.cameraQuaternion && !this.lastSentRotation.equals(positionReport.cameraQuaternion)) {
        this.rpcContext.sendProtoSceneEvent({
          type: EventDataType.RotationChanged,
          rotationChanged: {
            rotation: positionReport.cameraEuler,
            quaternion: positionReport.cameraQuaternion
          }
        })
        this.lastSentRotation.copyFrom(positionReport.cameraQuaternion)
      }
    }
  }

  private subscribeToPositionEvents() {
    this.positionObserver = positionObservable.add((obj) => {
      this.sendUserViewMatrix(obj)
    })
  }

  private subscribeToSceneChangeEvents() {
    this.sceneChangeObserver = sceneObservable.add((report) => {
      const userId = getCurrentUserId(store.getState())
      if (userId) {
        if (report.newScene?.sceneId === this.getSceneId()) {
          this.rpcContext.sendSceneEvent('onEnterScene', { userId })
        } else if (report.previousScene?.sceneId === this.getSceneId()) {
          this.rpcContext.sendSceneEvent('onLeaveScene', { userId })
        }
      }
    })
  }

  private subscribeToWorldRunningEvents() {
    this.renderStateObserver = renderStateObservable.add(() => {
      this.sendSceneReadyIfNecessary()
    })
  }

  private subscribeToSceneLifeCycleEvents() {
    this.sceneLifeCycleObserver = sceneLifeCycleObservable.add((obj) => {
      if (this.getSceneId() === obj.sceneId && obj.status === 'ready') {
        this.sceneReady = true
        sceneLifeCycleObservable.remove(this.sceneLifeCycleObserver)
        this.sendSceneReadyIfNecessary()
      }
    })
  }

  private sendSceneReadyIfNecessary() {
    if (!this.sceneStarted && this.sceneReady) {
      this.sceneStarted = true
      this.rpcContext.sendSceneEvent('sceneStart', {})
      renderStateObservable.remove(this.renderStateObserver)
    }
  }
}
