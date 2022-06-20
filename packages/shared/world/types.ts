import { LifecycleManager } from 'decentraland-loader/lifecycle/manager'
import { LoadableScene } from 'shared/types'

export type ParcelSceneLoadingState = {
  isWorldLoadingEnabled: boolean
  desiredParcelScenes: Map<string, LoadableScene>
  lifecycleManager: LifecycleManager
}
