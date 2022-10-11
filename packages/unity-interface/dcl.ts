import { DEBUG, EDITOR, ENGINE_DEBUG_PANEL, rootURLPreviewMode, SCENE_DEBUG_PANEL, SHOW_FPS_COUNTER } from 'config'
import './UnityInterface'
import {
  allScenesEvent,
  loadParcelSceneWorker,
  reloadScene,
  unloadParcelSceneById
} from 'shared/world/parcelSceneManager'
import { getUnityInstance } from './IUnityInterface'
import { clientDebug, ClientDebug } from './ClientDebug'
import { kernelConfigForRenderer } from './kernelConfigForRenderer'
import { store } from 'shared/store/isolatedStore'
import type { UnityGame } from '@dcl/unity-renderer/src'
import { traceDecoratorUnityGame } from './trace'
import defaultLogger from 'shared/logger'
import { ContentMapping, EntityType, Scene, sdk } from '@dcl/schemas'
import { ensureMetaConfigurationInitialized } from 'shared/meta'
import { reloadScenePortableExperience } from 'shared/portableExperiences/actions'
import { wearableToSceneEntity } from 'shared/wearablesPortableExperience/sagas'
import { fetchScenesByLocation } from 'shared/scene-loader/sagas'
import { sleep } from 'atomicHelpers/sleep'
import { signalRendererInitializedCorrectly } from 'shared/renderer/actions'
import { browserInterface } from './BrowserInterface'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const hudWorkerRaw = require('raw-loader!../../static/systems/decentraland-ui.scene.js')
const hudWorkerBLOB = new Blob([hudWorkerRaw])
export const hudWorkerUrl = URL.createObjectURL(hudWorkerBLOB)

declare const globalThis: { clientDebug: ClientDebug }

globalThis.clientDebug = clientDebug

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

  await browserInterface.startedFuture

  getUnityInstance().ActivateRendering()
  getUnityInstance().SetLoadingScreen({ isVisible: true, message: 'Initializing Decentraland', showTips: true })

  queueMicrotask(() => {
    // send an "engineStarted" notification, use a queueMicrotask
    // to escape the current stack leveraging the JS event loop
    store.dispatch(signalRendererInitializedCorrectly())
  })

  await ensureMetaConfigurationInitialized()

  getUnityInstance().SetKernelConfiguration(kernelConfigForRenderer())

  if (DEBUG) {
    getUnityInstance().SetDebug()
  }

  if (SCENE_DEBUG_PANEL) {
    getUnityInstance().SetKernelConfiguration({ debugConfig: { sceneDebugPanelEnabled: true } })
  }

  if (SHOW_FPS_COUNTER) {
    getUnityInstance().ShowFPSPanel()
  }

  if (ENGINE_DEBUG_PANEL) {
    getUnityInstance().SetEngineDebugPanel()
  }

  if (!EDITOR) {
    await startGlobalScene('dcl-gs-avatars', 'Avatars', hudWorkerUrl)
  }
}

async function startGlobalScene(
  cid: string,
  title: string,
  fileContentUrl: string,
  content: ContentMapping[] = [],
  baseUrl: string = location.origin
) {
  const metadata: Scene = {
    display: {
      title: title
    },
    main: 'game.js',
    scene: {
      base: '0,0',
      parcels: ['0,0']
    }
  }

  const scene = loadParcelSceneWorker({
    id: cid,
    baseUrl,
    entity: {
      content: [...content, { file: 'game.js', hash: fileContentUrl }],
      pointers: [cid],
      timestamp: 0,
      type: EntityType.SCENE,
      metadata,
      version: 'v3'
    }
  })

  scene.rpcContext.sceneData.isPortableExperience = true
  // portable experiences have no FPS limit
  scene.rpcContext.sceneData.useFPSThrottling = false
}

export async function getPreviewSceneId(): Promise<{ sceneId: string | null; sceneBase: string }> {
  const result = await fetch(new URL('scene.json?nocache=' + Math.random(), rootURLPreviewMode()).toString())

  if (result.ok) {
    const scene = (await result.json()) as Scene

    const scenes = await fetchScenesByLocation([scene.scene.base])
    if (!scenes.length) throw new Error('cant find scene ' + scene.scene.base)
    return { sceneId: scenes[0].id, sceneBase: scene.scene.base }
  } else {
    throw new Error('Could not load scene.json')
  }
}

export async function loadPreviewScene(message: sdk.Messages) {
  async function oldReload() {
    const { sceneId, sceneBase } = await getPreviewSceneId()
    if (sceneId) {
      await reloadScene(sceneId)
    } else {
      defaultLogger.log(`Unable to load sceneId of ${sceneBase}`)
      debugger
    }
  }

  if (message.type === sdk.SCENE_UPDATE && sdk.SceneUpdate.validate(message)) {
    if (message.payload.sceneType === sdk.ProjectType.PORTABLE_EXPERIENCE) {
      try {
        const { sceneId } = message.payload
        const url = `${rootURLPreviewMode()}/preview-wearables/${sceneId}`
        const collection: { data: any[] } = await (await fetch(url)).json()

        if (!!collection.data.length) {
          const wearable = collection.data[0]

          const entity = await wearableToSceneEntity(wearable, wearable.baseUrl)

          store.dispatch(reloadScenePortableExperience(entity))
        }
      } catch (err) {
        defaultLogger.error(`Unable to loader the preview portable experience`, message, err)
      }
    } else {
      if (message.payload.sceneId) {
        await reloadScene(message.payload.sceneId)
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

export async function reloadPlaygroundScene() {
  const playgroundCode: string = (globalThis as any).PlaygroundCode
  const playgroundContentMapping: ContentMapping[] = (globalThis as any).PlaygroundContentMapping || []
  const playgroundBaseUrl: string = (globalThis as any).PlaygroundBaseUrl || location.origin

  if (!playgroundCode) {
    console.log('There is no playground code')
    return
  }

  const sceneId = 'dcl-sdk-playground'

  await unloadParcelSceneById(sceneId)
  await sleep(300)

  const hudWorkerBLOB = new Blob([playgroundCode])
  const hudWorkerUrl = URL.createObjectURL(hudWorkerBLOB)
  await startGlobalScene(sceneId, 'SDK Playground', hudWorkerUrl, playgroundContentMapping, playgroundBaseUrl)
}

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
