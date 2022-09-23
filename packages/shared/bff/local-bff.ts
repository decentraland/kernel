import mitt from 'mitt'
import { BffEvents, BffServices, IBff } from 'shared/comms/types'
import { Realm } from 'shared/dao/types'
import { ExplorerIdentity } from 'shared/session/types'
import { localCommsService } from './local-services/comms'
import { realmToConnectionString } from './resolver'

export function localBff(realm: Realm, identity: ExplorerIdentity): IBff {
  const events = mitt<BffEvents>()

  const services: BffServices = {
    comms: localCommsService()
  }

  setTimeout(() => {
    // send the island_changed message
    events.emit('setIsland', {
      connStr: realmToConnectionString(realm),
      islandId: '',
      peers: {}
    })
  }, 100)

  return {
    events,
    services,
    async disconnect(error?: Error) {
      events.emit('DISCONNECTION', { error })
    }
  }
}
