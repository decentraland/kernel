import { LegacyServices } from '../types'

export function legacyServices(baseUrl: string): LegacyServices {
  return {
    fetchContentServer: baseUrl + '/content',
    catalystServer: baseUrl,
    updateContentServer: baseUrl + '/content',
    hotScenesService: baseUrl + '/lambdas/explore/hot-scenes',
    poiService: baseUrl + '/lambdas/contracts/pois',
    exploreRealmsService: baseUrl + '/lambdas/explore/realms'
  }
}
