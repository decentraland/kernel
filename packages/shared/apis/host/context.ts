import Protocol from 'devtools-protocol'
import { ILogger } from './../../logger'
import { EnvironmentData, ILand } from './../../types'
import { ParcelSceneAPI } from './../../../shared/world/ParcelSceneAPI'
import { pushableChannel } from '@dcl/rpc/dist/push-channel'
import { PermissionItem } from '../gen/Permissions'
import { BuilderManifest } from '../SceneStateStorageController/types'
import { BuilderServerAPIManager } from '../SceneStateStorageController/BuilderServerAPIManager'
import { SceneTransformTranslator } from './../SceneStateStorageController/SceneTransformTranslator'

const eventPushableChannel = (onIteratorClose: () => void) =>
  pushableChannel<{ id: string; data: any }>(onIteratorClose)

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }

export type PortContextService<K extends keyof PortContext> = WithRequired<PortContext, K>

export type PortContext = {
  EnvironmentAPI: {
    data: EnvironmentData<any>
  }
  EngineAPI: {
    parcelSceneAPI: ParcelSceneAPI
    subscribedEvents: { [event: string]: boolean }
  }
  Permissions: {
    permissionGranted: PermissionItem[]
  }
  ParcelIdentity: {
    land?: ILand
    cid: string
    isPortableExperience: boolean
    isEmpty: boolean
  }
  eventChannel: ReturnType<typeof eventPushableChannel>

  DevTools: {
    logger: ILogger
    logs: Protocol.Runtime.ConsoleAPICalledEvent[]
    exceptions: Map<number, Protocol.Runtime.ExceptionDetails>
  }

  SceneStateStorageController?: {
    builderManifest: BuilderManifest
    transformTranslator: SceneTransformTranslator
    _builderApiManager: BuilderServerAPIManager
  }
}
