import mitt from 'mitt'
import { RealmConnectionEvents, BffServices, IRealmAdapter } from '../types'
import { ExplorerIdentity } from 'shared/session/types'
import { localCommsService, localRoutingService, localMessagingService } from '../local-services/comms'
import { legacyServices } from '../local-services/legacy'
import { AboutResponse } from '@dcl/protocol/out-ts/decentraland/bff/http_endpoints.gen'

export function localBff(baseUrl: string, about: AboutResponse, identity: ExplorerIdentity): IRealmAdapter {
  const events = mitt<RealmConnectionEvents>()

  const services: BffServices = {
    comms: localCommsService(),
    routing: localRoutingService(),
    messaging: localMessagingService(),
    legacy: legacyServices(baseUrl, about)
  }

  return {
    about,
    baseUrl,
    events,
    services,
    async disconnect(error?: Error) {
      events.emit('DISCONNECTION', { error })
    }
  }
}
