import Protocol from 'devtools-protocol'
import { ILogger } from './../../logger'
import { EnvironmentData } from './../../types'
import { ParcelSceneAPI } from './../../../shared/world/ParcelSceneAPI'
import { pushableChannel } from '@dcl/rpc/dist/push-channel'
import { PermissionItem } from '../gen/Permissions'

const anyPushableChannel = (onIteratorClose: () => void) => pushableChannel<{ id: string; data: any }>(onIteratorClose)

export type PortContext = {
  EnvironmentAPI: {
    data: EnvironmentData<any>
  }
  EngineAPI: {
    didStart: boolean
    parcelSceneAPI: ParcelSceneAPI
    subscribedEvents: { [event: string]: boolean }
    eventChannel: ReturnType<typeof anyPushableChannel>
  }
  DevTools: {
    logger: ILogger
    logs: Protocol.Runtime.ConsoleAPICalledEvent[]
    exceptions: Map<number, Protocol.Runtime.ExceptionDetails>
  }
  Permissions: {
    permissionGranted: PermissionItem[]
  }
}
