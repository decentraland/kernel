import { Vector3 } from '@dcl/ecs-math'
import { createGenericLogComponent, defaultLogger } from 'shared/logger'
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
import Protocol from 'devtools-protocol'

export abstract class SceneWorker {
  public ready: SceneWorkerReadyState = SceneWorkerReadyState.LOADING

  public rpcContext!: PortContext
  private rpcServer!: RpcServer<PortContext>

  constructor(private readonly parcelScene: ParcelSceneAPI, public transport: Transport) {
    const eventChannel = pushableChannel<EngineEvent>(function () {})

    this.rpcContext = {
      EnvironmentAPI: {
        cid: parcelScene.data.sceneId,
        data: parcelScene.data
      },
      EngineAPI: {
        parcelSceneAPI: parcelScene,
        subscribedEvents: {}
      },
      Permissions: {
        permissionGranted: []
      },
      ParcelIdentity: {
        land: parcelScene.data.data?.land || parcelScene.data.data?.data?.land,
        isPortableExperience: false,
        isEmpty: false
      },
      DevTools: {
        logger: defaultLogger,
        exceptions: new Map<number, Protocol.Runtime.ExceptionDetails>()
      },
      eventChannel,
      sendSceneEvent: (type, data) => {
        eventChannel.push({ type, data }, (err) => {
          if (err) {
            this.rpcContext.DevTools.logger.error(err)
          }
        })
      }
    }

    parcelScene.registerWorker(this)

    this.rpcServer = createRpcServer<PortContext>({
      logger: createGenericLogComponent().getLogger(`rpc-server-${parcelScene.getSceneId()}`)
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
    this.rpcContext.sendSceneEvent(event, data)
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
