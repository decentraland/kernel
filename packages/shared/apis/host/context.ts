import Protocol from 'devtools-protocol'
import { ILogger } from './../../logger'
import { EnvironmentData, LoadableScene } from './../../types'
import { ParcelSceneAPI } from './../../../shared/world/ParcelSceneAPI'
import { PermissionItem } from '../proto/Permissions.gen'
import { EventData } from '../proto/EngineAPI.gen'

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }

export type PortContextService<K extends keyof PortContext> = WithRequired<PortContext, K>

export type PortContext = {
  EnvironmentAPI: {
    data: EnvironmentData<any>
  }
  EngineAPI: {
    parcelSceneAPI: ParcelSceneAPI
    subscribedEvents: Set<string>
  }
  Permissions: {
    permissionGranted: Set<PermissionItem>
  }
  sceneData: Readonly<LoadableScene & {
    isPortableExperience: boolean
  }>
  events: EventData[]

  sendSceneEvent<K extends keyof IEvents>(id: K, event: IEvents[K]): void
  sendProtoSceneEvent(event: EventData): void

  DevTools: {
    logger: ILogger
    exceptions: Map<number, Protocol.Runtime.ExceptionDetails>
  }
}
