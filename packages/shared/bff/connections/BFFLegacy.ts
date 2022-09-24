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
    legacy: legacyServices(baseUrl)
  }

  setTimeout(() => {
    let connStr = 'offline:offline'

    if (about.comms?.protocol == 'v2') {
      connStr = `lighthouse:${baseUrl}/comms`
    }

    // send the island_changed message
    events.emit('setIsland', {
      connStr,
      islandId: '',
      peers: {}
    })
  }, 100)

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
