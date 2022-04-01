import { DEBUG, EDITOR, ENGINE_DEBUG_PANEL, rootURLPreviewMode, SCENE_DEBUG_PANEL, SHOW_FPS_COUNTER } from 'config'
import './UnityInterface'
import { teleportTriggered } from 'shared/loading/types'
import { ILand, SceneJsonData } from 'shared/types'
import {
  allScenesEvent,
  enableParcelSceneLoading,
  loadParcelScene,
  onLoadParcelScenesObservable,
  onPositionSettledObservable,
  onPositionUnsettledObservable
} from 'shared/world/parcelSceneManager'
import { teleportObservable } from 'shared/world/positionThings'
import {
  observeLoadingStateChange,
  observeRendererStateChange,
  observeSessionStateChange,
  renderStateObservable
} from 'shared/world/worldState'
import { ILandToLoadableParcelScene } from 'shared/selectors'
import { UnityParcelScene } from './UnityParcelScene'
import { getUnityInstance } from './IUnityInterface'
import { clientDebug, ClientDebug } from './ClientDebug'
import { UnityScene } from './UnityScene'
import { ensureUiApis } from 'shared/world/uiSceneInitializer'
import { kernelConfigForRenderer } from './kernelConfigForRenderer'
import { store } from 'shared/store/isolatedStore'
import { isLoadingScreenVisible } from 'shared/loading/selectors'
import type { UnityGame } from '@dcl/unity-renderer/src'
import { reloadScene } from 'decentraland-loader/lifecycle/utils/reloadScene'
import { fetchSceneIds } from 'decentraland-loader/lifecycle/utils/fetchSceneIds'
import { signalParcelLoadingStarted } from 'shared/renderer/actions'
import { traceDecoratorUnityGame } from './trace'
import defaultLogger from 'shared/logger'
import { sdk } from '@dcl/schemas'
import { ensureMetaConfigurationInitialized } from 'shared/meta'
import { reloadScenePortableExperience } from 'shared/portableExperiences/actions'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const hudWorkerRaw = require('raw-loader!../../static/systems/decentraland-ui.scene.js')
const hudWorkerBLOB = new Blob([hudWorkerRaw])
export const hudWorkerUrl = URL.createObjectURL(hudWorkerBLOB)

declare const globalThis: { clientDebug: ClientDebug }

globalThis.clientDebug = clientDebug

export function setLoadingScreenBasedOnState() {
  const state = store.getState()

  if (!state) {
    getUnityInstance().SetLoadingScreen({
      isVisible: true,
      message: 'Loading...',
      showTips: true
    })
    return
  }

  const loading = state.loading

  getUnityInstance().SetLoadingScreen({
    isVisible: isLoadingScreenVisible(state),
    message: loading.message || loading.status || '',
    showTips: loading.initialLoad || !state.renderer.parcelLoadingStarted
  })
}

////////////////////////////////////////////////////////////////////////////////

/**
 *
 * Common initialization logic for the unity engine
 *
 * @param _gameInstance Unity game instance
 */
export async function initializeEngine(_gameInstance: UnityGame): Promise<void> {
  const gameInstance = traceDecoratorUnityGame(_gameInstance)

  getUnityInstance().Init(gameInstance)

  getUnityInstance().DeactivateRendering()

  await ensureMetaConfigurationInitialized()

  getUnityInstance().SetKernelConfiguration(kernelConfigForRenderer())

  if (DEBUG) {
    getUnityInstance().SetDebug()
  }

  if (SCENE_DEBUG_PANEL) {
    getUnityInstance().SetKernelConfiguration({ debugConfig: { sceneDebugPanelEnabled: true } })
    getUnityInstance().SetSceneDebugPanel()
  }

  if (SHOW_FPS_COUNTER) {
    getUnityInstance().ShowFPSPanel()
  }

  if (ENGINE_DEBUG_PANEL) {
    getUnityInstance().SetEngineDebugPanel()
  }

  observeLoadingStateChange(() => {
    setLoadingScreenBasedOnState()
  })
  observeSessionStateChange(() => {
    setLoadingScreenBasedOnState()
  })
  observeRendererStateChange(() => {
    setLoadingScreenBasedOnState()
  })
  renderStateObservable.add(() => {
    setLoadingScreenBasedOnState()
  })
  setLoadingScreenBasedOnState()

  if (!EDITOR) {
    await startGlobalScene('dcl-gs-avatars', 'Avatars', hudWorkerUrl)
  }
}

export async function startGlobalScene(cid: string, title: string, fileContentUrl: string) {
  const scene = new UnityScene({
    sceneId: cid,
    name: title,
    baseUrl: location.origin,
    main: fileContentUrl,
    useFPSThrottling: false,
    data: {},
    mappings: []
  })

  const worker = loadParcelScene(scene, undefined, true)

  await ensureUiApis(worker)

  getUnityInstance().CreateGlobalScene({
    id: scene.getSceneId(),
    name: scene.data.name,
    baseUrl: scene.data.baseUrl,
    isPortableExperience: false,
    contents: []
  })
}

export async function startUnitySceneWorkers() {
  onLoadParcelScenesObservable.add((lands) => {
    getUnityInstance().LoadParcelScenes(
      lands.map(($) => {
        const x = Object.assign({}, ILandToLoadableParcelScene($).data)
        delete x.land
        return x
      })
    )
  })
  onPositionSettledObservable.add((spawnPoint) => {
    getUnityInstance().Teleport(spawnPoint)
    getUnityInstance().ActivateRendering()
  })

  onPositionUnsettledObservable.add(() => {
    getUnityInstance().DeactivateRendering()
  })

  await enableParcelSceneLoading()

  store.dispatch(signalParcelLoadingStarted())
}

export async function getPreviewSceneId(): Promise<{ sceneId: string | null; sceneBase: string }> {
  const jsonData = await getPreviewSceneJson()
  const [sceneId] = await fetchSceneIds([jsonData.scene.base])
  return { sceneId, sceneBase: jsonData.scene.base }
}

async function getPreviewSceneJson() {
  const result = await fetch('/scene.json?nocache=' + Math.random())
  if (result.ok) {
    return (await result.json()) as SceneJsonData
  } else {
    throw new Error('Could not load scene.json')
  }
}

export async function loadPreviewScene(message: sdk.Messages) {
  async function oldReload() {
    const { sceneId, sceneBase } = await getPreviewSceneId()
    if (sceneId) {
      await doReload(sceneId)
    } else {
      defaultLogger.log(`Unable to load sceneId of ${sceneBase}`)
      debugger
    }
  }

  async function doReload(sceneId: string) {
    await reloadScene(sceneId)

    // We get scene json here to use hot-reload to update displayed spawnpoints
    // since the ILand info is not currently changing on hot-reload
    getPreviewSceneJson()
      .then((sceneJson) => clientDebug.ToggleSceneSpawnPoints(sceneId, undefined, sceneJson))
      .catch((e) => defaultLogger.error(e))
  }

  if (message.type === sdk.SCENE_UPDATE && sdk.SceneUpdate.validate(message)) {
    if (message.payload.sceneType === sdk.ProjectType.PORTABLE_EXPERIENCE) {
      try {
        const { sceneId } = message.payload
        const url = `${rootURLPreviewMode()}/preview-wearables/${sceneId}`
        const collection: { data: any[] } = await (await fetch(url)).json()

        if (!!collection.data.length) {
          const wearable = collection.data[0]
          store.dispatch(
            reloadScenePortableExperience({
              id: wearable.id,
              parentCid: 'main',
              name: wearable.name,
              baseUrl: `${wearable.baseUrl}/`,
              mappings: wearable.data.scene,
              // TODO
              menuBarIcon: 'pending' //wearable.data.
            })
          )
        }
      } catch (err) {
        defaultLogger.error(`Unable to loader the preview portable experience`, message, err)
      }
    } else {
      if (message.payload.sceneId) {
        await doReload(message.payload.sceneId)
      } else {
        await oldReload()
      }
    }
  } else if (message.type === 'update') {
    defaultLogger.log(`Please update your CLI version to 3.9.0 or more.`, { message })
    await oldReload()
  } else {
    defaultLogger.log(`Unable to process message in loadPreviewScene`, { message })
  }
}

export function loadBuilderScene(_sceneData: ILand): UnityParcelScene | undefined {
  // NOTE: check file history for previous implementation
  throw new Error('Not implemented')
}

export function unloadCurrentBuilderScene() {
  // NOTE: check file history for previous implementation
  throw new Error('Not implemented')
}

export function updateBuilderScene(_sceneData: ILand) {
  // NOTE: check file history for previous implementation
  throw new Error('Not implemented')
}

teleportObservable.add((position: { x: number; y: number; text?: string }) => {
  // before setting the new position, show loading screen to avoid showing an empty world
  store.dispatch(teleportTriggered(position.text || `Teleporting to ${position.x}, ${position.y}`))
})

{
  // TODO: move to unity-renderer
  let isPointerLocked: boolean = false

  function pointerLockChange() {
    const doc: any = document
    const isLocked = !!(doc.pointerLockElement || doc.mozPointerLockElement || doc.webkitPointerLockElement)
    if (isPointerLocked !== isLocked && getUnityInstance()) {
      getUnityInstance().SetCursorState(isLocked)
    }
    isPointerLocked = isLocked
    allScenesEvent({
      eventType: 'onPointerLock',
      payload: {
        locked: isPointerLocked
      }
    })
  }

  document.addEventListener('pointerlockchange', pointerLockChange, false)
}
