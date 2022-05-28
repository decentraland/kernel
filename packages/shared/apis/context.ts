import Protocol from 'devtools-protocol'
import { ILogger } from './../logger'
import { EnvironmentData } from './../types'
import { ParcelSceneAPI } from '../../shared/world/ParcelSceneAPI'

export type PortContext = {
  EnvironmentAPI: {
    data: EnvironmentData<any>
  }
  EngineAPI: {
    didStart: boolean
    parcelSceneAPI: ParcelSceneAPI
    subscribedEvents: { [event: string]: boolean }
  }
  DevTools: {
    logger: ILogger
    logs: Protocol.Runtime.ConsoleAPICalledEvent[]
    exceptions: Map<number, Protocol.Runtime.ExceptionDetails>
  }
}
