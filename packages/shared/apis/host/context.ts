import Protocol from 'devtools-protocol'
import { ILogger } from './../../logger'
import { EnvironmentData } from './../../types'
import { ParcelSceneAPI } from './../../../shared/world/ParcelSceneAPI'
import { PermissionItem } from '../proto/Permissions.gen'
import { EventData } from '../proto/EngineAPI.gen'
import { EntityWithBaseUrl } from 'decentraland-loader/lifecycle/lib/types'

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
    entity: EntityWithBaseUrl
    isPortableExperience: boolean
    isEmpty: boolean
  }
  events: EventData[]

  sendSceneEvent<K extends keyof IEvents>(id: K, event: IEvents[K]): void
  sendProtoSceneEvent(event: EventData): void

  DevTools: {
    logger: ILogger
    exceptions: Map<number, Protocol.Runtime.ExceptionDetails>
  }
}
