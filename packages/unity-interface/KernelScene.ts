import { WSS_ENABLED, FORCE_SEND_MESSAGE, DEBUG_MESSAGES_QUEUE_PERF, DEBUG_SCENE_LOG } from 'config'
import defaultLogger, { createDummyLogger, createLogger, ILogger } from 'shared/logger'
import { EntityAction, LoadableScene } from 'shared/types'
import { SceneWorker } from 'shared/world/SceneWorker'
import { getUnityInstance } from './IUnityInterface'
import { protobufMsgBridge } from './protobufMessagesBridge'
import { nativeMsgBridge } from './nativeMessagesBridge'
import { permissionItemFromJSON } from 'shared/apis/proto/Permissions.gen'
import { Scene } from '@dcl/schemas'
import { gridToWorld, parseParcelPosition } from 'atomicHelpers/parcelScenePositions'
import { Vector3 } from '@dcl/ecs-math'
import { getSceneNameFromJsonData } from 'shared/selectors'

const sendBatchTime: Array<number> = []
const sendBatchMsgs: Array<number> = []
let sendBatchTimeCount: number = 0
let sendBatchMsgCount: number = 0

export class KernelScene {
  worker!: SceneWorker
  logger: ILogger
  initMessageCount: number = 0
  initFinished: boolean = false
  metadata: Scene

  constructor(public loadableScene: LoadableScene) {
    this.metadata = loadableScene.entity.metadata

    const loggerName = getSceneNameFromJsonData(this.metadata) || loadableScene.id
    const loggerPrefix = `scene: [${loggerName}]`
    this.logger = DEBUG_SCENE_LOG ? createLogger(loggerPrefix) : createDummyLogger()

    if (!Scene.validate(loadableScene.entity.metadata)) {
      this.logger.error('Invalid scene metadata', loadableScene.entity.metadata, Scene.validate.errors)
    }
  }

  sendBatch(actions: EntityAction[]): void {
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

  sendBatchWss(actions: EntityAction[]): void {
    const sceneId = this.loadableScene.id
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

      const part = protobufMsgBridge.encodeSceneMessage(sceneId, action.type, action.payload, action.tag)
      messages.push(part)
      len += part.length

      if (len > 1024 * 1024) {
        flush()
      }
    }

    flush()
  }

  sendBatchNative(actions: EntityAction[]): void {
    const sceneId = this.loadableScene.id
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      nativeMsgBridge.SendNativeMessage(sceneId, action)
    }
  }

  registerWorker(worker: SceneWorker): void {
    this.worker = worker

    const aux: Vector3 = new Vector3()
    const basePosition = parseParcelPosition(this.metadata.scene?.base)
    gridToWorld(basePosition.x, basePosition.y, aux)
    worker.setPosition(aux)

    worker.rpcContext.sceneData = { ...this.loadableScene, isPortableExperience: false, useFPSThrottling: false }
    worker.rpcContext.sendBatch = this.sendBatch.bind(this)

    if (this.metadata.requiredPermissions) {
      for (const permissionItemString of this.metadata.requiredPermissions) {
        this.worker.rpcContext.permissionGranted.add(permissionItemFromJSON(permissionItemString))
      }
    }
  }
}
