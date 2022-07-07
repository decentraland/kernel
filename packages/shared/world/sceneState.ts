import { Observable } from 'mz-observable'
import { fetchScenesByLocation } from 'decentraland-loader/lifecycle/utils/fetchSceneIds'
import { parcelObservable } from './positionThings'
import { LoadableScene } from 'shared/types'

export type SceneReport = {
  /** Scene where the user was */
  previousScene?: LoadableScene
  /** Scene the user just entered */
  newScene?: LoadableScene
}

// Called each time the user changes scene
export const sceneObservable = new Observable<SceneReport>()
export let lastPlayerScene: LoadableScene | undefined

// Listen to parcel changes, and notify if the scene changed
parcelObservable.add(async ({ newParcel }) => {
  const parcelString = `${newParcel.x},${newParcel.y}`
  if (!lastPlayerScene || !lastPlayerScene.entity.metadata.scene.parcels.includes(parcelString)) {
    const lands = await fetchScenesByLocation([parcelString])
    if (lands.length) {
      sceneObservable.notifyObservers({ previousScene: lastPlayerScene, newScene: lands[0] })
      lastPlayerScene = lands[0]
    } else {
      sceneObservable.notifyObservers({ previousScene: lastPlayerScene })
      lastPlayerScene = undefined
    }
  }
})
