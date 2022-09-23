import { Realm } from 'shared/dao/types'
import { LegacyServices } from '../types'

export function legacyServices(realm: Realm): LegacyServices {
  const domain = realm.hostname

  return {
    fetchContentServer: domain + '/content',
    catalystServer: domain,
    updateContentServer: domain + '/content',
    hotScenesService: domain + '/lambdas/explore/hot-scenes',
    poiService: domain + '/lambdas/contracts/pois',
    exploreRealmsService: domain + '/lambdas/explore/realms'
  }
}
