import { Vector3 } from '@dcl/ecs-math'
import { defaultLogger } from 'shared/logger'
import { ParcelSceneAPI } from './ParcelSceneAPI'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { createRpcServer, RpcServer, Transport } from '@dcl/rpc'

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

import { registerServices } from 'shared/apis/host'
import { PortContext } from 'shared/apis/host/context'
import { pushableChannel } from '@dcl/rpc/dist/push-channel'

function createGenericLogComponent() {
  return {
    getLogger(loggerName) {
      return {
        log(message, extra) {
          defaultLogger.log(loggerName, message, extra)
        },
        warn(message, extra) {
          defaultLogger.warn(loggerName, message, extra)
        },
        info(message, extra) {
          defaultLogger.info(loggerName, message, extra)
        },
        debug(message, extra) {
          defaultLogger.trace(loggerName, message, extra)
        },
        error(error, extra) {
          let message = `${error}`
          let printTrace = true
          if (error instanceof Error && 'stack' in error && typeof error.stack === 'string') {
            if (error.stack.includes(error.message)) {
              message = error.stack
              printTrace = false
            }
          }
          defaultLogger.error(loggerName, message, extra || error)
          if (printTrace) {
            console.trace()
          }
        }
      }
    }
  }
}

export abstract class SceneWorker {
  public ready: SceneWorkerReadyState = SceneWorkerReadyState.LOADING

  private rpcServer: RpcServer<PortContext> | null = null
  public rpcContext!: PortContext

  public patchContext(ctx: Partial<PortContext>) {
    this.rpcContext = { ...this.rpcContext, ...ctx }
  }

  public get getRpcContext() {
    return this.rpcContext
  }

  constructor(private readonly parcelScene: ParcelSceneAPI, public transport: Transport) {
    this.rpcContext = {
      eventChannel: pushableChannel<any>(function () {})
    }

    parcelScene.registerWorker(this)

    this.rpcServer = createRpcServer<PortContext>({
      logger: createGenericLogComponent().getLogger('test-rpc-server')
    })
    this.rpcServer.setHandler(async (port) => {
      registerServices(port)
    })
    this.rpcServer.attachTransport(transport as Transport, this.rpcContext)
    this.ready |= SceneWorkerReadyState.LOADED
  }

  abstract setPosition(position: Vector3): void
  abstract isPersistent(): boolean
  abstract hasSceneStarted(): boolean

  getSceneId(): string {
    return this.parcelScene.data.sceneId
  }

  getParcelScene(): ParcelSceneAPI {
    return this.parcelScene
  }

  emit<T extends IEventNames>(event: T, data: IEvents[T]): void {
    this.parcelScene.emit(event, data)
  }

  sendSubscriptionEvent<K extends IEventNames>(event: K, data: IEvents[K]) {
    this.rpcContext.eventChannel.push({ id: event, data }).catch((err) => defaultLogger.error(err))
  }

  dispose() {
    const disposingFlags =
      SceneWorkerReadyState.DISPOSING | SceneWorkerReadyState.SYSTEM_DISPOSED | SceneWorkerReadyState.DISPOSED

    if ((this.ready & disposingFlags) === 0) {
      this.ready |= SceneWorkerReadyState.DISPOSING
      this.childDispose()

      this.ready |= SceneWorkerReadyState.DISPOSED
    }

    getUnityInstance().UnloadScene(this.getSceneId())

    this.transport.close()
    this.ready |= SceneWorkerReadyState.DISPOSED
  }

  protected abstract childDispose(): void
}
