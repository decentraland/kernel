import { Quaternion, Vector3 } from '@dcl/ecs-math'
import {
  DEBUG_MESSAGES_QUEUE_PERF,
  DEBUG_SCENE_LOG,
  FORCE_SEND_MESSAGE,
  playerConfigurations,
  WSS_ENABLED
} from 'config'
import { PositionReport } from './positionThings'
import { Observable, Observer } from 'mz-observable'
import { store } from 'shared/store/isolatedStore'
import { createRpcServer, RpcServer, Transport } from '@dcl/rpc'
import { WebWorkerTransport } from '@dcl/rpc/dist/transports/WebWorker'
import { EventDataType } from 'shared/protocol/kernel/apis/EngineAPI.gen'
import { registerServices } from 'shared/apis/host'
import { PortContext } from 'shared/apis/host/context'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { trackEvent } from 'shared/analytics'
import { getSceneNameFromJsonData } from 'shared/selectors'
import { Scene } from '@dcl/schemas'
import { signalSceneLoad, signalSceneStart, signalSceneFail, signalSceneUnload } from 'shared/loading/actions'
import { EntityAction, LoadableScene } from 'shared/types'
import defaultLogger, { createDummyLogger, createLogger, ILogger } from 'shared/logger'
import { gridToWorld, parseParcelPosition } from 'atomicHelpers/parcelScenePositions'
import { nativeMsgBridge } from 'unity-interface/nativeMessagesBridge'
import { protobufMsgBridge } from 'unity-interface/protobufMessagesBridge'
import { permissionItemFromJSON } from 'shared/protocol/kernel/apis/Permissions.gen'
import { incrementAvatarSceneMessages } from 'shared/session/getPerformanceInfo'
import { getCurrentUserId } from 'shared/session/selectors'

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

const sendBatchTime: Array<number> = []
const sendBatchMsgs: Array<number> = []
let sendBatchTimeCount: number = 0
let sendBatchMsgCount: number = 0

export type SceneLifeCycleStatusType = 'unloaded' | 'awake' | 'loaded' | 'ready' | 'failed'
export type SceneLifeCycleStatusReport = { sceneId: string; status: SceneLifeCycleStatusType }

export const sceneLifeCycleObservable = new Observable<Readonly<SceneLifeCycleStatusReport>>()

function buildWebWorkerTransport(loadableScene: LoadableScene): Transport {
  const loggerName = getSceneNameFromJsonData(loadableScene.entity.metadata) || loadableScene.id

  const worker = new Worker(sceneRuntimeUrl, {
    name: `Scene(${loggerName},${(loadableScene.entity.metadata as Scene).scene?.base})`
  })

  return WebWorkerTransport(worker)
}

let globalSceneNumberCounter = 0

export class SceneWorker {
  public ready: SceneWorkerReadyState = SceneWorkerReadyState.LOADING

  public rpcContext!: PortContext
  public sceneReady: boolean = false
  private rpcServer!: RpcServer<PortContext>

  private sceneStarted: boolean = false

  private position: Vector3 = new Vector3()
  private readonly lastSentPosition = new Vector3(0, 0, 0)
  private readonly lastSentRotation = new Quaternion(0, 0, 0, 1)
  private sceneLifeCycleObserver: Observer<any> | null = null
  private readonly startLoadingTime = performance.now()

  metadata: Scene
  logger: ILogger

  constructor(
    public readonly loadableScene: Readonly<LoadableScene>,
    public readonly transport: Transport = buildWebWorkerTransport(loadableScene)
  ) {
    ++globalSceneNumberCounter
    const sceneNumber = globalSceneNumberCounter

    const skipErrors = ['Transport closed while waiting the ACK']

    this.metadata = loadableScene.entity.metadata

    const loggerName = getSceneNameFromJsonData(this.metadata) || loadableScene.id
    const loggerPrefix = `scene: [${loggerName}]`
    this.logger = DEBUG_SCENE_LOG ? createLogger(loggerPrefix) : createDummyLogger()

    if (!Scene.validate(loadableScene.entity.metadata)) {
      defaultLogger.error('Invalid scene metadata', loadableScene.entity.metadata, Scene.validate.errors)
    }

    this.rpcContext = {
      sceneData: {
        isPortableExperience: false,
        useFPSThrottling: false,
        ...loadableScene,
        sceneNumber
      },
      logger: this.logger,
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
      sendBatch: this.sendBatch.bind(this)
    }

    // if the scene metadata has a base parcel, then we set it as the position
    // used for the zero of coordinates
    if (loadableScene.entity.metadata.scene?.base) {
      const metadata: Scene = loadableScene.entity.metadata
      const basePosition = parseParcelPosition(metadata.scene?.base)
      gridToWorld(basePosition.x, basePosition.y, this.position)
    }

    this.rpcServer = createRpcServer<PortContext>({
      logger: {
        ...this.logger,
        debug: this.logger.log,
        error: (error: string | Error, extra?: Record<string, string | number>) => {
          if (!(error instanceof Error && skipErrors.includes(error.message))) {
            this.logger.error(error, extra)
          }
        }
      }
    })

    if (this.metadata.requiredPermissions) {
      for (const permissionItemString of this.metadata.requiredPermissions) {
        this.rpcContext.permissionGranted.add(permissionItemFromJSON(permissionItemString))
      }
    }

    // attachTransport is executed in a microtask to defer its execution stack
    // and enable external customizations to this.rpcContext as it could be the
    // permissions of the scene or the FPS limit
    queueMicrotask(() => this.attachTransport())
  }

  dispose() {
    const disposingFlags =
      SceneWorkerReadyState.DISPOSING | SceneWorkerReadyState.SYSTEM_DISPOSED | SceneWorkerReadyState.DISPOSED

    queueMicrotask(() => {
      // this NEEDS to run in a microtask because sagas control this .dispose
      store.dispatch(signalSceneUnload(this.loadableScene))
    })

    if ((this.ready & disposingFlags) === 0) {
      this.ready |= SceneWorkerReadyState.DISPOSING

      this.childDispose()
      this.transport.close()

      this.ready |= SceneWorkerReadyState.DISPOSED
    }
    try {
      getUnityInstance().UnloadSceneV2(this.rpcContext.sceneData.sceneNumber)
    } catch (err: any) {
      defaultLogger.error(err)
    }
    getUnityInstance().UnloadScene(this.loadableScene.id)
    this.ready |= SceneWorkerReadyState.DISPOSED
  }

  // when the current user enters the scene
  onEnter() {
    const userId = getCurrentUserId(store.getState())
    if (userId) this.rpcContext.sendSceneEvent('onEnterScene', { userId })
  }

  // when the current user leaves the scene
  onLeave() {
    const userId = getCurrentUserId(store.getState())
    if (userId) this.rpcContext.sendSceneEvent('onLeaveScene', { userId })
  }

  protected childDispose() {
    if (this.sceneLifeCycleObserver) {
      sceneLifeCycleObservable.remove(this.sceneLifeCycleObserver)
      this.sceneLifeCycleObserver = null
    }
  }

  private attachTransport() {
    this.rpcServer.setHandler(registerServices)
    this.rpcServer.attachTransport(this.transport as Transport, this.rpcContext)
    this.ready |= SceneWorkerReadyState.LOADED

    this.subscribeToSceneLifeCycleEvents()

    queueMicrotask(() => {
      // this NEEDS to run in a microtask or timeout
      store.dispatch(signalSceneLoad(this.loadableScene))
    })

    const WORKER_TIMEOUT = 30_000 // thirty seconds

    setTimeout(() => {
      if (!this.sceneStarted) {
        this.ready |= SceneWorkerReadyState.LOADING_FAILED
        store.dispatch(signalSceneFail(this.loadableScene))
      }
    }, WORKER_TIMEOUT)
  }

  private sendBatch(actions: EntityAction[]): void {
    if (this.loadableScene.id === 'dcl-gs-avatars') {
      incrementAvatarSceneMessages(actions.length)
    }

    let time = Date.now()
    if (WSS_ENABLED || FORCE_SEND_MESSAGE) {
      this.sendBatchWss(actions)
    } else {
      this.sendBatchNative(actions)
    }

    if (DEBUG_MESSAGES_QUEUE_PERF) {
      time = Date.now() - time

      sendBatchTime.push(time)
      sendBatchMsgs.push(actions.length)

      sendBatchTimeCount += time

      sendBatchMsgCount += actions.length

      while (sendBatchMsgCount >= 10000) {
        sendBatchTimeCount -= sendBatchTime.splice(0, 1)[0]
        sendBatchMsgCount -= sendBatchMsgs.splice(0, 1)[0]
      }

      defaultLogger.log(`sendBatch time total for msgs ${sendBatchMsgCount} calls: ${sendBatchTimeCount}ms ... `)
    }
  }

  private sendBatchWss(actions: EntityAction[]): void {
    const sceneId = this.loadableScene.id
    const sceneNumber = this.rpcContext.sceneData.sceneNumber
    const messages: string[] = []
    let len = 0

    function flush() {
      if (len) {
        getUnityInstance().SendSceneMessage(messages.join('\n'))
        messages.length = 0
        len = 0
      }
    }

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]

      // Check moved from SceneRuntime.ts->DecentralandInterface.componentUpdate() here until we remove base64 support.
      // This way we can still initialize problematic scenes in the Editor, otherwise the protobuf encoding explodes with such messages.
      if (action.payload.json?.length > 49000) {
        this.logger.error('Component payload cannot exceed 49.000 bytes. Skipping message.')

        continue
      }

      const part = protobufMsgBridge.encodeSceneMessage(sceneId, sceneNumber, action.type, action.payload, action.tag)
      messages.push(part)
      len += part.length

      if (len > 1024 * 1024) {
        flush()
      }
    }

    flush()
  }

  private sendBatchNative(actions: EntityAction[]): void {
    const sceneId = this.loadableScene.id
    const sceneNumber = this.rpcContext.sceneData.sceneNumber
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      nativeMsgBridge.SendNativeMessage(sceneId, sceneNumber, action)
    }
  }

  public sendUserViewMatrix(positionReport: Readonly<PositionReport>) {
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

  private subscribeToSceneLifeCycleEvents() {
    this.sceneLifeCycleObserver = sceneLifeCycleObservable.add((obj) => {
      if (this.loadableScene.id === obj.sceneId && obj.status === 'ready') {
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

      const baseParcel = this.metadata.scene.base

      trackEvent('scene_start_event', {
        scene_id: this.loadableScene.id,
        time_since_creation: performance.now() - this.startLoadingTime,
        base: baseParcel
      })
      queueMicrotask(() => {
        // this NEEDS to run in a microtask
        store.dispatch(signalSceneStart(this.loadableScene))
      })
    }
  }
}
