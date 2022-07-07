import { ILogger } from './../../logger'
import { EntityAction, LoadableScene } from './../../types'
import { PermissionItem } from '../proto/Permissions.gen'
import { EventData } from '../proto/EngineAPI.gen'

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }

export type PortContextService<K extends keyof PortContext> = WithRequired<PortContext, K>

export type PortContext = {
  permissionGranted: Set<PermissionItem>
  sceneData: LoadableScene & {
    isPortableExperience: boolean
    useFPSThrottling: boolean
  }
  subscribedEvents: Set<string>
  events: EventData[]

  // @deprecated
  sendBatch(actions: EntityAction[]): void
  sendSceneEvent<K extends keyof IEvents>(id: K, event: IEvents[K]): void
  sendProtoSceneEvent(event: EventData): void
  logger: ILogger
  crdtMessages: Uint8Array[]
  sendCrdtMessage(payload: Uint8Array): void
}
