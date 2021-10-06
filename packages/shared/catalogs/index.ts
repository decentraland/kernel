import { PartialWearableV2, WearableId } from './types'
import { getPlatformCatalog } from './selectors'
import { wearablesRequest } from './actions'
import { store } from '../store/isolatedStore'

export async function getWearables(wearableIds: WearableId[]): Promise<PartialWearableV2[]> {
  const catalog = getPlatformCatalog(store.getState()) ?? {}
  const pendingWearables = wearableIds.filter((wId) => !Object.keys(catalog).includes(wId))

  if (pendingWearables.length === 0) {
    return Promise.resolve(wearableIds.map((wId) => catalog[wId]))
  }

  store.dispatch(wearablesRequest({ wearableIds: pendingWearables }))

  return new Promise<PartialWearableV2[]>((resolve) => {
    const unsubscribe = store.subscribe(() => {
      const catalog = getPlatformCatalog(store.getState()) ?? {}
      const catalogKeys = Object.keys(catalog)
      if (pendingWearables.every((wId) => catalogKeys.includes(wId))) {
        unsubscribe()
        return resolve(wearableIds.map((wId) => catalog[wId]))
      }
    })
  })
}
