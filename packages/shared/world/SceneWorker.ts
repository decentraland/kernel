import { Quaternion, Vector3 } from '@dcl/ecs-math'
import { playerConfigurations } from 'config'
import { PositionReport, positionObservable } from './positionThings'
import { Observable, Observer } from 'mz-observable'
import { sceneObservable } from 'shared/world/sceneState'
import { getCurrentUserId } from 'shared/session/selectors'
import { store } from 'shared/store/isolatedStore'
import { createRpcServer, RpcServer, Transport } from '@dcl/rpc'
import { WebWorkerTransport } from '@dcl/rpc/dist/transports/WebWorker'
import { EventDataType } from 'shared/apis/proto/EngineAPI.gen'
import { registerServices } from 'shared/apis/host'
import { PortContext } from 'shared/apis/host/context'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { trackEvent } from 'shared/analytics'
import { getSceneNameFromJsonData } from 'shared/selectors'
import { Scene } from '@dcl/schemas'
import {
  signalSceneLoad,
  signalSceneStart,
  signalSceneFail,
  SceneFail,
  SceneStart,
  SceneLoad
} from 'shared/loading/actions'
import { SceneLifeCycleStatusReport } from 'decentraland-loader/lifecycle/controllers/scene'
import { KernelScene } from 'unity-interface/KernelScene'

export enum SceneWorkerReadyState {
  LOADING = 1 << 0,
  LOADED = 1 << 1,
  STARTED = 1 << 2,
  LOADING_FAILED = 1 << 4,
  SYSTEM_FAILED = 1 << 5,
  DISPOSING = 1 << 6,
  SYSTEM_DISPOSED = 1 << 7,
  DISPOSED = 1 << 8
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sceneRuntimeRaw = require('raw-loader!../../../static/systems/scene.system.js')
const sceneRuntimeBLOB = new Blob([sceneRuntimeRaw])
const sceneRuntimeUrl = URL.createObjectURL(sceneRuntimeBLOB)

export const workerStatusObservable = new Observable<SceneLoad | SceneStart | SceneFail>()
export const sceneLifeCycleObservable = new Observable<Readonly<SceneLifeCycleStatusReport>>()

function buildWebWorkerTransport(parcelScene: KernelScene): Transport {
  const loggerName = getSceneNameFromJsonData(parcelScene.loadableScene.entity.metadata) || parcelScene.loadableScene.id

  const worker = new Worker(sceneRuntimeUrl, {
    name: `Scene(${loggerName},${(parcelScene.loadableScene.entity.metadata as Scene).scene?.base})`
  })

  return WebWorkerTransport(worker)
}

export class SceneWorker {
  public ready: SceneWorkerReadyState = SceneWorkerReadyState.LOADING

  public rpcContext!: PortContext
  private rpcServer!: RpcServer<PortContext>

  private sceneStarted: boolean = false

  private position!: Vector3
  private readonly lastSentPosition = new Vector3(0, 0, 0)
  private readonly lastSentRotation = new Quaternion(0, 0, 0, 1)
  private positionObserver: Observer<any> | null = null
  private sceneLifeCycleObserver: Observer<any> | null = null
  private sceneChangeObserver: Observer<any> | null = null
  private readonly startLoadingTime = performance.now()
  private sceneReady: boolean = false

  constructor(public kernelScene: KernelScene, public transport: Transport = buildWebWorkerTransport(kernelScene)) {
    const skipErrors = ['Transport closed while waiting the ACK']

    this.rpcContext = {
      sceneData: {
        ...kernelScene.loadableScene,
        isPortableExperience: false,
        useFPSThrottling: true
      },
      logger: kernelScene.logger,
      permissionGranted: new Set(),
      subscribedEvents: new Set(['sceneStart']),
      events: [],
      sendSceneEvent: (type, data) => {
        if (this.rpcContext.subscribedEvents.has(type)) {
          this.rpcContext.events.push({
            type: EventDataType.Generic,
            generic: {
              eventId: type,
              eventData: JSON.stringify(data)
            }
          })
        }
      },
      sendProtoSceneEvent: (e) => {
        this.rpcContext.events.push(e)
      },
      sendBatch() {
        throw new Error('sendBatch not initialized')
      }
    }

    kernelScene.registerWorker(this)

    this.rpcServer = createRpcServer<PortContext>({
      logger: {
        ...kernelScene.logger,
        debug: kernelScene.logger.log,
        error: (error: string | Error, extra?: Record<string, string | number>) => {
          if (!(error instanceof Error && skipErrors.includes(error.message))) {
            kernelScene.logger.error(error, extra)
          }
        }
      }
    })

    this.rpcServer.setHandler(registerServices)
    this.rpcServer.attachTransport(transport as Transport, this.rpcContext)
    this.ready |= SceneWorkerReadyState.LOADED

    this.subscribeToSceneLifeCycleEvents()
    this.subscribeToPositionEvents()
    this.subscribeToSceneChangeEvents()

    workerStatusObservable.notifyObservers(signalSceneLoad(this.kernelScene.loadableScene))

    const WORKER_TIMEOUT = 90_000 // three minutes

    setTimeout(() => {
      if (!this.hasSceneStarted()) {
        this.ready |= SceneWorkerReadyState.LOADING_FAILED
        workerStatusObservable.notifyObservers(signalSceneFail(this.kernelScene.loadableScene))
      }
    }, WORKER_TIMEOUT)
  }

  setPosition(position: Vector3) {
    // This method is called before position is reported by the renderer
    if (!this.position) {
      this.position = new Vector3()
    }
    this.position.copyFrom(position)
  }

  hasSceneStarted(): boolean {
    return this.sceneStarted
  }

  dispose() {
    const disposingFlags =
      SceneWorkerReadyState.DISPOSING | SceneWorkerReadyState.SYSTEM_DISPOSED | SceneWorkerReadyState.DISPOSED

    if ((this.ready & disposingFlags) === 0) {
      this.ready |= SceneWorkerReadyState.DISPOSING

      this.childDispose()
      this.transport.close()

      this.ready |= SceneWorkerReadyState.DISPOSED
    }

    getUnityInstance().UnloadScene(this.kernelScene.loadableScene.id)
    this.ready |= SceneWorkerReadyState.DISPOSED
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
    if (this.sceneChangeObserver) {
      sceneObservable.remove(this.sceneChangeObserver)
      this.sceneChangeObserver = null
    }
  }

  private sendUserViewMatrix(positionReport: Readonly<PositionReport>) {
    if (this.rpcContext.subscribedEvents.has('positionChanged')) {
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
    if (this.rpcContext.subscribedEvents.has('rotationChanged')) {
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
        const sceneId = this.kernelScene.loadableScene.id
        if (report.newScene?.id === sceneId) {
          this.rpcContext.sendSceneEvent('onEnterScene', { userId })
        } else if (report.previousScene?.id === sceneId) {
          this.rpcContext.sendSceneEvent('onLeaveScene', { userId })
        }
      }
    })
  }

  private subscribeToSceneLifeCycleEvents() {
    this.sceneLifeCycleObserver = sceneLifeCycleObservable.add((obj) => {
      if (this.kernelScene.loadableScene.id === obj.sceneId && obj.status === 'ready') {
        this.ready |= SceneWorkerReadyState.STARTED

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

      trackEvent('scene_start_event', {
        scene_id: this.kernelScene.loadableScene.id,
        time_since_creation: performance.now() - this.startLoadingTime
      })

      workerStatusObservable.notifyObservers(signalSceneStart(this.kernelScene.loadableScene))
    }
  }
}
