import { Quaternion, Vector3 } from '@dcl/ecs-math'
import { DEBUG_SCENE_LOG, FORCE_SEND_MESSAGE, playerConfigurations, WSS_ENABLED } from 'config'
import { PositionReport } from './positionThings'
import { createRpcServer, RpcServer, Transport } from '@dcl/rpc'
import { WebWorkerTransport } from '@dcl/rpc/dist/transports/WebWorker'
import { EventDataType } from '@dcl/protocol/out-ts/decentraland/kernel/apis/engine_api.gen'
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
import { permissionItemFromJSON } from '@dcl/protocol/out-ts/decentraland/kernel/apis/permissions.gen'
import { incrementAvatarSceneMessages } from 'shared/session/getPerformanceInfo'
import { getCurrentUserId } from 'shared/session/selectors'
import { store } from 'shared/store/isolatedStore'

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
const sceneRuntimeRaw =
  process.env.NODE_ENV === 'production'
    ? require('raw-loader!@dcl/scene-runtime/dist/webworker.js')
    : require('raw-loader!@dcl/scene-runtime/dist/webworker.dev.js')

const sceneRuntimeBLOB = new Blob([sceneRuntimeRaw])
const sceneRuntimeUrl = URL.createObjectURL(sceneRuntimeBLOB)

export type SceneLifeCycleStatusType = 'unloaded' | 'awake' | 'loaded' | 'ready' | 'failed'
export type SceneLifeCycleStatusReport = { sceneId: string; status: SceneLifeCycleStatusType }

function buildWebWorkerTransport(loadableScene: LoadableScene): Transport {
  const loggerName = getSceneNameFromJsonData(loadableScene.entity.metadata) || loadableScene.id

  const worker = new Worker(sceneRuntimeUrl, {
    name: `Scene(${loggerName},${(loadableScene.entity.metadata as Scene).scene?.base})`
  })

  worker.addEventListener('error', (err) => {
    trackEvent('errorInSceneWorker', {
      message: err.message,
      scene: loadableScene.id,
      pointers: loadableScene.entity.pointers
    })
  })

  return WebWorkerTransport(worker)
}

let globalSceneNumberCounter = 0

export class SceneWorker {
  public ready: SceneWorkerReadyState = SceneWorkerReadyState.LOADING

  public rpcContext!: PortContext
  private rpcServer!: RpcServer<PortContext>

  private sceneStarted: boolean = false

  private position: Vector3 = new Vector3()
  private readonly lastSentPosition = new Vector3(0, 0, 0)
  private readonly lastSentRotation = new Quaternion(0, 0, 0, 1)
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
            type: EventDataType.EDT_GENERIC,
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

  // when the engine says "the scene is ready" or it did fail to load
  onReady() {
    this.ready |= SceneWorkerReadyState.STARTED

    if (!this.sceneStarted) {
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

  private attachTransport() {
    this.rpcServer.setHandler(registerServices)
    this.rpcServer.attachTransport(this.transport, this.rpcContext)
    this.ready |= SceneWorkerReadyState.LOADED

    queueMicrotask(() => {
      // this NEEDS to run in a microtask or timeout
      store.dispatch(signalSceneLoad(this.loadableScene))
    })

    const WORKER_TIMEOUT = 30_000 // thirty seconds

    setTimeout(() => {
      if (!this.sceneStarted) {
        this.ready |= SceneWorkerReadyState.LOADING_FAILED

        this.sceneStarted = true
        this.rpcContext.sendSceneEvent('sceneStart', {})

        store.dispatch(signalSceneFail(this.loadableScene))
      }
    }, WORKER_TIMEOUT)
  }

  private sendBatch(actions: EntityAction[]): void {
    if (this.loadableScene.id === 'dcl-gs-avatars') {
      incrementAvatarSceneMessages(actions.length)
    }

    if (WSS_ENABLED || FORCE_SEND_MESSAGE) {
      this.sendBatchWss(actions)
    } else {
      this.sendBatchNative(actions)
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
          type: EventDataType.EDT_POSITION_CHANGED,
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
          type: EventDataType.EDT_ROTATION_CHANGED,
          rotationChanged: {
            rotation: positionReport.cameraEuler,
            quaternion: positionReport.cameraQuaternion
          }
        })
        this.lastSentRotation.copyFrom(positionReport.cameraQuaternion)
      }
    }
  }
}
