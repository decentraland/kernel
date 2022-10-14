import { ILogger } from './../../logger'
import { EntityAction, LoadableScene } from './../../types'
import { PermissionItem } from '@dcl/protocol/out-ts/decentraland/kernel/apis/permissions.gen'
import { EventData } from '@dcl/protocol/out-ts/decentraland/kernel/apis/engine_api.gen'

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }

export type PortContextService<K extends keyof PortContext> = WithRequired<PortContext, K>

export type PortContext = {
  permissionGranted: Set<PermissionItem>
  sceneData: LoadableScene & {
    isPortableExperience: boolean
    useFPSThrottling: boolean
    readonly sceneNumber: number
  }
  subscribedEvents: Set<string>
  events: EventData[]

  // @deprecated
  sendBatch(actions: EntityAction[]): void
  sendSceneEvent<K extends keyof IEvents>(id: K, event: IEvents[K]): void
  sendProtoSceneEvent(event: EventData): void
  logger: ILogger
}
