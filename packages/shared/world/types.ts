import { LifecycleManager } from 'decentraland-loader/lifecycle/manager'

export type ParcelSceneLoadingState = {
  isWorldLoadingEnabled: boolean
  desiredParcelScenes: Set<string>
  lifecycleManager: LifecycleManager
}
