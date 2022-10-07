import mitt from 'mitt'
import { BffEvents, BffServices, IBff } from '../types'
import { ExplorerIdentity } from 'shared/session/types'
import { localCommsService } from '../local-services/comms'
import { legacyServices } from '../local-services/legacy'
import { AboutResponse } from 'shared/protocol/bff/http-endpoints.gen'

export function localBff(baseUrl: string, about: AboutResponse, identity: ExplorerIdentity): IBff {
  const events = mitt<BffEvents>()

  const services: BffServices = {
    comms: localCommsService(),
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