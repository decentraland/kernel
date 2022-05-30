/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Vector3 } from '@dcl/ecs-math'
// import { future } from 'fp-future'
// import { APIOptions, ScriptingHost } from 'decentraland-rpc/lib/host'
import { ScriptingTransport } from 'decentraland-rpc/lib/common/json-rpc/types'
// import { defaultLogger } from 'shared/logger'
// import { PREVIEW } from 'config'
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

import { registerEngineAPIServiceServerImplementation } from 'shared/apis/EngineAPI'
import { registerEnvironmentAPIServiceServerImplementation } from 'shared/apis/EnvironmentAPI'
import { registerDevToolsServiceServerImplementation } from 'shared/apis/DevTools'
import { PortContext } from 'shared/apis/context'
// import Protocol from 'devtools-protocol'

export abstract class SceneWorker {
  public ready: SceneWorkerReadyState = SceneWorkerReadyState.LOADING
  // protected engineAPI: EngineAPI | null = null
  // private readonly system = future<ScriptingHost>()

  private rpcServer: RpcServer<PortContext> | null = null
  private rpcContext!: PortContext

  public patchContext(ctx: Partial<PortContext>) {
    this.rpcContext = { ...this.rpcContext, ...ctx }
  }
  public get getRpcContext() {
    return this.rpcContext
  }

  public get useOldRpc() {
    return this.oldRpc
  }

  constructor(
    private readonly parcelScene: ParcelSceneAPI,
    private oldRpc: boolean,
    public transport: Transport | ScriptingTransport
  ) {
    parcelScene.registerWorker(this)

    if (oldRpc) {
      throw new Error('Old RPC is deprecated')
      // this.startSystem(transport as ScriptingTransport)
      //   .then(($) => this.system.resolve($))
      //   .catch(($) => this.system.reject($))
    } else {
      this.rpcServer = createRpcServer<PortContext>({})

      this.rpcServer.setHandler(async function handler(port) {
        console.log('  Creating server port: ' + port.portName)
        registerDevToolsServiceServerImplementation(port)
        registerEngineAPIServiceServerImplementation(port)
        registerEnvironmentAPIServiceServerImplementation(port)
      })

      this.rpcServer.attachTransport(transport as Transport, this.rpcContext)
      this.ready |= SceneWorkerReadyState.LOADED
    }
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

  getAPIInstance<X>(api: any): Promise<X> {
    throw new Error('getAPIInstance is a depracated methods')
    // return this.system.then((system) => system.getAPIInstance(api))
  }

  sendSubscriptionEvent<K extends IEventNames>(event: K, data: IEvents[K]) {
    // TODO: send subscription event
    // this.engineAPI?.sendSubscriptionEvent(event, data)
  }

  dispose() {
    const disposingFlags =
      SceneWorkerReadyState.DISPOSING | SceneWorkerReadyState.SYSTEM_DISPOSED | SceneWorkerReadyState.DISPOSED

    if ((this.ready & disposingFlags) === 0) {
      this.ready |= SceneWorkerReadyState.DISPOSING
      this.childDispose()

      // TODO: Unmount the system
      // this.system
      //   .then((system) => {
      //     try {
      //       system.unmount()
      //     } catch (e) {
      //       defaultLogger.error('Error unmounting system', e)
      //     }
      //     this.ready |= SceneWorkerReadyState.SYSTEM_DISPOSED
      //   })
      //   .catch((e) => {
      //     defaultLogger.error('Unable to unmount system', e)
      //     this.ready |= SceneWorkerReadyState.SYSTEM_DISPOSED
      //   })

      this.ready |= SceneWorkerReadyState.DISPOSED
    }

    getUnityInstance().UnloadScene(this.getSceneId())

    if (!this.useOldRpc) {
      this.transport.close()
      this.ready |= SceneWorkerReadyState.DISPOSED
    }
  }

  protected abstract childDispose(): void

  // private async startSystem(transport: ScriptingTransport) {
  //   const system = await ScriptingHost.fromTransport(transport)
  //   this.engineAPI = system.getAPIInstance('EngineAPI') as EngineAPI
  //   this.engineAPI.parcelSceneAPI = this.parcelScene
  //   system.getAPIInstance(EnvironmentAPI).data = this.parcelScene.data
  //   // TODO: track this errors using rollbar because this kind of event are usually triggered due to setInterval() or unreliable code in scenes, that is not sandboxed
  //   system.on('error', (e) => {
  //     // @ts-ignore
  //     console['log']('Unloading scene because of unhandled exception in the scene worker: ')
  //     // @ts-ignore
  //     console['error'](e)
  //     // These errors should be handled in development time
  //     if (PREVIEW) {
  //       eval('debu' + 'gger')
  //     }
  //     transport.close()
  //     this.ready |= SceneWorkerReadyState.SYSTEM_FAILED
  //   })
  //   system.enable()
  //   this.ready |= SceneWorkerReadyState.LOADED
  //   return system
  // }
}
