import Protocol from 'devtools-protocol'
import { ILogger } from './../../logger'
import { EnvironmentData, ILand } from './../../types'
import { ParcelSceneAPI } from './../../../shared/world/ParcelSceneAPI'
import { PermissionItem } from '../proto/Permissions.gen'
import { BuilderManifest } from '../SceneStateStorageController/types'
import { BuilderServerAPIManager } from '../SceneStateStorageController/BuilderServerAPIManager'
import { SceneTransformTranslator } from './../SceneStateStorageController/SceneTransformTranslator'

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }

export type PortContextService<K extends keyof PortContext> = WithRequired<PortContext, K>

export type PortContext = {
  EnvironmentAPI: {
    cid: string
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
    isPortableExperience: boolean
    isEmpty: boolean
  }
  events: EngineEvent[]

  sendSceneEvent<K extends keyof IEvents>(id: K, event: IEvents[K]): void

  DevTools: {
    logger: ILogger
    exceptions: Map<number, Protocol.Runtime.ExceptionDetails>
  }

  SceneStateStorageController?: {
    builderManifest: BuilderManifest
    transformTranslator: SceneTransformTranslator
    _builderApiManager: BuilderServerAPIManager
  }
}
