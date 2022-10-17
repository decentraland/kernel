import { apply, call, fork, put, race, select, take, takeEvery, takeLatest } from 'redux-saga/effects'
import { SCENE_CHANGED } from 'shared/loading/actions'
import { BEFORE_UNLOAD } from 'shared/actions'
import { SetParcelPosition, SET_PARCEL_POSITION } from 'shared/scene-loader/actions'
import { getParcelPosition } from 'shared/scene-loader/selectors'
import { setCurrentScene, SignalSceneReady, SIGNAL_SCENE_READY } from './actions'
import { getLoadedParcelSceneByPointer, getSceneWorkerBySceneID, loadedSceneWorkers } from './parcelSceneManager'
import { SceneWorker } from './SceneWorker'
import { getCurrentUserId } from 'shared/session/selectors'

declare let location: any
declare let history: any

export function* worldSagas() {
  // FIRST bind all sagas
  yield fork(sceneObservableProcess)
  yield fork(updateUrlPosition)
  yield takeEvery(SIGNAL_SCENE_READY, function* (action: SignalSceneReady) {
    getSceneWorkerBySceneID(action.payload.sceneId)?.onReady()
  })
}

// This saga only updates the URL with the current parcel
function* updateUrlPosition() {
  let lastTime: number = performance.now()

  function updateUrlPosition(action: SetParcelPosition) {
    const newParcel = action.payload.position
    // Update position in URI every second
    if (performance.now() - lastTime > 1000) {
      replaceQueryStringPosition(newParcel.x, newParcel.y)
      lastTime = performance.now()
    }
  }

  // react to all position changes
  yield takeLatest(SET_PARCEL_POSITION, updateUrlPosition)
}

// This saga reacts to every parcel position change and worker load/unload
// to always emit the correct message when we are either standing, entering or
// leaving a scene.
// It also calls the .onEnter and .onLeave of the SceneWorker(s)
function* sceneObservableProcess() {
  let lastPlayerScene: SceneWorker | undefined

  while (true) {
    const { unload } = yield race({
      unload: take(BEFORE_UNLOAD),
      position: take(SET_PARCEL_POSITION),
      sceneChanged: take(SCENE_CHANGED)
    })

    if (unload) return

    const newParcel: ReadOnlyVector2 = yield select(getParcelPosition)
    const parcelString = `${newParcel.x},${newParcel.y}`

    if (lastPlayerScene && !loadedSceneWorkers.has(lastPlayerScene.loadableScene.id)) {
      lastPlayerScene = undefined
    }

    if (!lastPlayerScene || !lastPlayerScene.loadableScene.entity.metadata.scene.parcels.includes(parcelString)) {
      // find which scene we are standing in
      const newScene: SceneWorker | undefined = yield call(getLoadedParcelSceneByPointer, parcelString)
      const userId: string = yield select(getCurrentUserId)

      if (newScene === lastPlayerScene) continue

      // notify new scene and store it
      yield put(setCurrentScene(newScene, lastPlayerScene))

      // send signals of enter and leave to the scenes
      if (newScene) yield apply(newScene, newScene.onEnter, [userId])
      if (lastPlayerScene) yield apply(lastPlayerScene, lastPlayerScene.onLeave, [userId])

      // new state
      lastPlayerScene = newScene
    }
  }
}

function replaceQueryStringPosition(x: any, y: any) {
  const currentPosition = `${x | 0},${y | 0}`

  const q = new URLSearchParams(location.search)
  q.set('position', currentPosition)

  history.replaceState({ position: currentPosition }, 'position', `?${q.toString()}`)
}
