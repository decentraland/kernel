import { Vector2Component } from 'atomicHelpers/landHelpers'
import type { MinimapSceneInfo } from '@dcl/legacy-ecs'
import { call, put, select, take, takeEvery, takeLatest } from 'redux-saga/effects'
import { parcelLimits } from 'config'
import { fetchScenesByLocation } from '../../decentraland-loader/lifecycle/utils/fetchSceneIds'
import {
  getOwnerNameFromJsonData,
  getSceneDescriptionFromJsonData,
  getThumbnailUrlFromJsonDataAndContent
} from 'shared/selectors'
import defaultLogger from '../logger'
import { lastPlayerPosition } from '../world/positionThings'
import {
  ReportScenesAroundParcel,
  reportedScenes,
  REPORT_SCENES_AROUND_PARCEL,
  reportScenesAroundParcel,
  reportLastPosition,
  initializePoiTiles,
  INITIALIZE_POI_TILES,
  ReportScenesFromTile,
  reportScenesFromTiles,
  REPORT_SCENES_FROM_TILES,
  SetHomeScene,
  setHomeScene,
  SET_HOME_SCENE
} from './actions'
import { getPoiTiles, postProcessSceneName } from './selectors'
import { RootAtlasState } from './types'
import { getTilesRectFromCenter } from '../getTilesRectFromCenter'
import { LoadableScene } from 'shared/types'
import { SCENE_LOAD } from 'shared/loading/actions'
import { parseParcelPosition, worldToGrid } from '../../atomicHelpers/parcelScenePositions'
import { PARCEL_LOADING_STARTED } from 'shared/renderer/types'
import { META_CONFIGURATION_INITIALIZED } from '../meta/actions'
import { getFetchContentServer, getPOIService } from 'shared/dao/selectors'
import { store } from 'shared/store/isolatedStore'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { waitForRendererInstance } from 'shared/renderer/sagas-helper'
import { waitForRealmInitialized } from 'shared/dao/sagas'
import { Scene } from '@dcl/schemas'

export function* atlasSaga(): any {
  yield takeEvery(SCENE_LOAD, checkAndReportAround)

  yield takeLatest(META_CONFIGURATION_INITIALIZED, initializePois)
  yield takeLatest(PARCEL_LOADING_STARTED, reportPois)

  yield takeLatest(REPORT_SCENES_AROUND_PARCEL, reportScenesAroundParcelAction)
  yield takeEvery(REPORT_SCENES_FROM_TILES, reportScenesFromTilesAction)
  yield takeEvery(SET_HOME_SCENE, setHomeSceneAction)
}

const TRIGGER_DISTANCE = 10 * parcelLimits.parcelSize
const MAX_SCENES_AROUND = 15

function* checkAndReportAround() {
  const userPosition = lastPlayerPosition
  const lastReport: Vector2Component | undefined = yield select((state) => state.atlas.lastReportPosition)

  if (
    !lastReport ||
    Math.abs(userPosition.x - lastReport.x) > TRIGGER_DISTANCE ||
    Math.abs(userPosition.z - lastReport.y) > TRIGGER_DISTANCE
  ) {
    const gridPosition = worldToGrid(userPosition)

    yield put(reportScenesAroundParcel(gridPosition, MAX_SCENES_AROUND))
    yield put(reportLastPosition({ x: userPosition.x, y: userPosition.z }))
  }
}

function* waitForPoiTilesInitialization() {
  while (!(yield select((state: RootAtlasState) => state.atlas.hasPois))) {
    yield take(INITIALIZE_POI_TILES)
  }
}

function* reportPois() {
  yield call(waitForPoiTilesInitialization)

  const pois: string[] = yield select(getPoiTiles)

  yield put(reportScenesFromTiles(pois))
}

function* reportScenesAroundParcelAction(action: ReportScenesAroundParcel) {
  const tilesAround = getTilesRectFromCenter(action.payload.parcelCoord, action.payload.scenesAround)
  yield put(reportScenesFromTiles(tilesAround))
}

function* initializePois() {
  yield call(waitForRealmInitialized)

  const daoPOIs: string[] | undefined = yield call(fetchPOIsFromDAO)

  if (daoPOIs) {
    yield put(initializePoiTiles(daoPOIs))
  } else {
    yield put(initializePoiTiles([]))
  }
}

function* reportScenesFromTilesAction(action: ReportScenesFromTile) {
  const tiles = action.payload.tiles
  const result: Array<LoadableScene> = yield call(fetchScenesByLocation, tiles)

  yield call(reportScenes, result)
  yield put(reportedScenes(tiles))
}

function* setHomeSceneAction(action: SetHomeScene) {
  defaultLogger.warn(`Setting home scene to ${action.payload.position}`)
  yield call(setHomeScene(action.payload.position))
  getUnityInstance().UpdateHomeScene(action.payload.position);
}

function* reportScenes(scenes: LoadableScene[]): any {
  yield call(waitForPoiTilesInitialization)
  const pois = yield select(getPoiTiles)

  const minimapSceneInfoResult: MinimapSceneInfo[] = []

  scenes.forEach((scene) => {
    const parcels: Vector2Component[] = []
    let isPOI: boolean = false
    const metadata: Scene | undefined = scene.entity.metadata

    if (metadata) {
      let sceneName = metadata.display?.title || ''

      metadata.scene.parcels.forEach((parcel) => {
        const xy: Vector2Component = parseParcelPosition(parcel)

        if (pois.includes(parcel)) {
          isPOI = true
          sceneName = sceneName || metadata.scene.base
        }

        parcels.push(xy)
      })

      minimapSceneInfoResult.push({
        name: postProcessSceneName(sceneName),
        owner: getOwnerNameFromJsonData(metadata),
        description: getSceneDescriptionFromJsonData(metadata),
        previewImageUrl: getThumbnailUrlFromJsonDataAndContent(
          metadata,
          scene.entity.content,
          getFetchContentServer(store.getState())
        ),
        // type is not used by renderer
        type: undefined as any,
        parcels,
        isPOI
      })
    }
  })

  yield call(waitForRendererInstance)
  getUnityInstance().UpdateMinimapSceneInformation(minimapSceneInfoResult)
}

async function fetchPOIsFromDAO(): Promise<string[] | undefined> {
  const url = getPOIService(store.getState())
  try {
    const response = await fetch(url)
    if (response.ok) {
      const result = await response.json()
      return result
    }
  } catch (error) {
    defaultLogger.warn(`Error while fetching POIs from DAO ${error}`)
  }
}
