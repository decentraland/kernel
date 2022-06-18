import { EntityWithBaseUrl } from 'decentraland-loader/lifecycle/lib/types'
import { LifecycleManager } from 'decentraland-loader/lifecycle/manager'

export type ParcelSceneLoadingState = {
  isWorldLoadingEnabled: boolean
  desiredParcelScenes: Map<string, EntityWithBaseUrl>
  lifecycleManager: LifecycleManager
}
