import { Observable } from 'mz-observable'
import { fetchSceneIds } from 'decentraland-loader/lifecycle/utils/fetchSceneIds'
import { fetchSceneJson } from 'decentraland-loader/lifecycle/utils/fetchSceneJson'
import { parcelObservable } from './positionThings'
import { EntityWithBaseUrl } from 'decentraland-loader/lifecycle/lib/types'

export type SceneReport = {
  /** Scene where the user was */
  previousScene?: EntityWithBaseUrl
  /** Scene the user just entered */
  newScene?: EntityWithBaseUrl
}

// Called each time the user changes scene
export const sceneObservable = new Observable<SceneReport>()
export let lastPlayerScene: EntityWithBaseUrl | undefined

// Listen to parcel changes, and notify if the scene changed
parcelObservable.add(async ({ newParcel }) => {
  const parcelString = `${newParcel.x},${newParcel.y}`
  if (!lastPlayerScene || !lastPlayerScene.metadata.scene.parcels.includes(parcelString)) {
    const scenesId = await fetchSceneIds([parcelString])
    const sceneId = scenesId[0]
    if (sceneId) {
      const land = (await fetchSceneJson([sceneId]))[0]
      sceneObservable.notifyObservers({ previousScene: lastPlayerScene, newScene: land })
      lastPlayerScene = land
    } else {
      sceneObservable.notifyObservers({ previousScene: lastPlayerScene })
      lastPlayerScene = undefined
    }
  }
})
