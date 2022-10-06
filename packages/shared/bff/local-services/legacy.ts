import { AboutResponse } from 'shared/protocol/bff/http-endpoints.gen'
import { LegacyServices } from '../types'

export function legacyServices(baseUrl: string, about: AboutResponse): LegacyServices {
  const contentServer = about.content?.publicUrl || baseUrl + '/content'
  const lambdasServer = about.lambdas?.publicUrl || baseUrl + '/lambdas'

  return {
    fetchContentServer: contentServer,
    catalystServer: 'https://peer.decentraland.org',
    updateContentServer: contentServer,
    hotScenesService: lambdasServer + '/explore/hot-scenes',
    poiService: lambdasServer + '/contracts/pois',
    exploreRealmsService: lambdasServer + '/explore/realms'
  }
}
