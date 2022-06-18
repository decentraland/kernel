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
import Protocol from 'devtools-protocol'
import { EventDataType } from 'shared/apis/proto/EngineAPI.gen'

export abstract class SceneWorker {
  public ready: SceneWorkerReadyState = SceneWorkerReadyState.LOADING

  public rpcContext!: PortContext
  private rpcServer!: RpcServer<PortContext>

  constructor(private readonly parcelScene: ParcelSceneAPI, public transport: Transport) {
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
        entity: parcelScene.data.data?.entity,
        isPortableExperience: false,
        isEmpty: false
      },
      DevTools: {
        logger: defaultLogger,
        exceptions: new Map<number, Protocol.Runtime.ExceptionDetails>()
      },
      events: [],
      sendSceneEvent: (type, data) => {
        this.rpcContext.events.push({
          type: EventDataType.Generic,
          generic: {
            eventId: type,
            eventData: JSON.stringify(data)
          }
        })
      },
      sendProtoSceneEvent: (e) => {
        this.rpcContext.events.push(e)
      }
    }

    parcelScene.registerWorker(this)

    const skipErrors = ['Transport closed while waiting the ACK']
    const logger = createGenericLogComponent().getLogger(`rpc-server-${parcelScene.getSceneId()}`)

    this.rpcServer = createRpcServer<PortContext>({
      logger: {
        ...logger,
        error: (error: string | Error, extra?: Record<string, string | number>) => {
          if (!(error instanceof Error && skipErrors.includes(error.message))) {
            logger.error(error, extra)
          }
        }
      }
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
      this.transport.close()

      this.ready |= SceneWorkerReadyState.DISPOSED
    }

    getUnityInstance().UnloadScene(this.getSceneId())
    this.ready |= SceneWorkerReadyState.DISPOSED
  }

  protected abstract childDispose(): void
}
