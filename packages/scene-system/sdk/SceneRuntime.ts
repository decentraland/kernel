import { LoadableAPIs } from '../../shared/apis/client'
import { componentSerializeOpt, initMessagesFinished, numberToIdStore, resolveMapping } from './Utils'
import { customEval, prepareSandboxContext } from './sandbox'
import { RpcClient } from '@dcl/rpc/dist/types'
import { PermissionItem } from 'shared/protocol/kernel/apis/Permissions.gen'

import { createDecentralandInterface, DecentralandInterfaceOptions } from './runtime/DecentralandInterface'
import { setupFpsThrottling } from './runtime/SetupFpsThrottling'

import { DevToolsAdapter } from './runtime/DevToolsAdapter'
import { RuntimeEventCallback, RuntimeEvent, SceneRuntimeEventState, EventDataToRuntimeEvent } from './runtime/Events'
import { parseParcelPosition } from 'atomicHelpers/parcelScenePositions'
import { Scene } from '@dcl/schemas'

export async function startSceneRuntime(client: RpcClient) {
  const workerName = self.name
  const clientPort = await client.createPort(`scene-${workerName}`)

  const [EngineAPI, EnvironmentAPI, Permissions, DevTools] = await Promise.all([
    LoadableAPIs.EngineAPI(clientPort),
    LoadableAPIs.EnvironmentAPI(clientPort),
    LoadableAPIs.Permissions(clientPort),
    LoadableAPIs.DevTools(clientPort)
  ])

  const [canUseWebsocket, canUseFetch] = (
    await Permissions.hasManyPermissions({
      permissions: [PermissionItem.USE_WEBSOCKET, PermissionItem.USE_FETCH]
    })
  ).hasManyPermission

  const devToolsAdapter = new DevToolsAdapter(DevTools)
  const eventState: SceneRuntimeEventState = { allowOpenExternalUrl: false }
  const onEventFunctions: RuntimeEventCallback[] = []
  const onUpdateFunctions: ((dt: number) => void)[] = []
  const onStartFunctions: (() => void)[] = []
  const batchEvents: DecentralandInterfaceOptions['batchEvents'] = {
    events: []
  }

  const bootstrapData = await EnvironmentAPI.getBootstrapData({})
  const fullData: Scene = JSON.parse(bootstrapData.entity?.metadataJson || '{}')
  const isPreview = await EnvironmentAPI.isPreviewMode({})
  const unsafeAllowed = await EnvironmentAPI.areUnsafeRequestAllowed({})

  const explorerConfiguration = await EnvironmentAPI.getExplorerConfiguration({})

  if (!fullData || !fullData.main) {
    throw new Error(`No boostrap data`)
  }

  const mappingName = fullData.main
  const mapping = bootstrapData.entity?.content.find(($) => $.file === mappingName)

  if (!mapping) {
    await EngineAPI.sendBatch({ actions: [initMessagesFinished()] })
    throw new Error(`SDK: Error while loading scene. Main file missing.`)
  }

  const url = resolveMapping(mapping.hash, mappingName, bootstrapData.baseUrl)
  const codeRequest = await fetch(url)

  if (!codeRequest.ok) {
    await EngineAPI.sendBatch({ actions: [initMessagesFinished()] })
    throw new Error(
      `SDK: Error while loading ${url} (${mappingName} -> ${mapping?.file}:${mapping?.hash}) the mapping was not found`
    )
  }

  componentSerializeOpt.useBinaryTransform = explorerConfiguration.configurations['enableBinaryTransform'] === 'true'

  let didStart = false
  let updateIntervalMs: number = 1000 / 30

  async function sendBatchAndProcessEvents() {
    const actions = batchEvents.events

    if (actions.length) {
      batchEvents.events = []
    }

    const res = await EngineAPI.sendBatch({ actions })
    for (const e of res.events) {
      eventReceiver(EventDataToRuntimeEvent(e))
    }
  }

  function eventReceiver(event: RuntimeEvent) {
    if (event.type === 'raycastResponse') {
      const idAsNumber = parseInt(event.data.queryId, 10)
      if (numberToIdStore[idAsNumber]) {
        event.data.queryId = numberToIdStore[idAsNumber].toString()
      }
    }

    if (!didStart && event.type === 'sceneStart') {
      didStart = true
      for (const startFunctionCb of onStartFunctions) {
        try {
          startFunctionCb()
        } catch (e: any) {
          devToolsAdapter.error(e)
        }
      }
    }

    if (isPointerEvent(event)) {
      eventState.allowOpenExternalUrl = true
    }

    for (const cb of onEventFunctions) {
      try {
        cb(event)
      } catch (err: any) {
        devToolsAdapter.error(err)
      }
    }
    eventState.allowOpenExternalUrl = false
  }

  let start = performance.now()

  function reschedule() {
    const ms = Math.max((updateIntervalMs - (performance.now() - start)) | 0, 0)
    setTimeout(mainLoop, ms)
  }

  function mainLoop() {
    const now = performance.now()
    const dtMillis = now - start
    start = now

    const dtSecs = dtMillis / 1000

    for (const trigger of onUpdateFunctions) {
      try {
        trigger(dtSecs)
      } catch (e: any) {
        devToolsAdapter.error(e)
      }
    }

    sendBatchAndProcessEvents().catch(devToolsAdapter.error).finally(reschedule)
  }

  try {
    const sourceCode = await codeRequest.text()

    const dcl = createDecentralandInterface({
      clientPort,
      onError: (err: Error) => devToolsAdapter.error(err),
      onLog: (...args: any) => devToolsAdapter.log(...args),
      sceneId: bootstrapData.id,
      eventState,
      batchEvents,
      EngineAPI,
      onEventFunctions,
      onStartFunctions,
      onUpdateFunctions
    })

    // create the context for the scene
    const runtimeExecutionContext = prepareSandboxContext({
      dcl,
      canUseFetch,
      canUseWebsocket,
      log: dcl.log,
      previewMode: isPreview.isPreview || unsafeAllowed.status
    })

    if (bootstrapData.useFPSThrottling === true) {
      setupFpsThrottling(dcl, fullData.scene.parcels.map(parseParcelPosition), (newValue) => {
        updateIntervalMs = newValue
      })
    }

    // run the code of the scene
    await customEval(sourceCode, runtimeExecutionContext)
  } catch (err) {
    await EngineAPI.sendBatch({ actions: [initMessagesFinished()] })

    devToolsAdapter.error(new Error(`SceneRuntime: Error while evaluating the scene ${workerName}`))

    // The devToolsAdapter.error isn't a async function
    //  and the port can be closed because the finishing of the worker
    await sleep(100)

    throw err
  }
  // then notify the kernel that the initial scene was loaded
  batchEvents.events.push(initMessagesFinished())

  // wait for didStart=true
  do {
    await sendBatchAndProcessEvents()
  } while (!didStart && (await sleep(100)))

  // finally, start event loop
  mainLoop()

  // shutdown
}

function isPointerEvent(event: RuntimeEvent): boolean {
  switch (event.type) {
    case 'uuidEvent':
      return event.data?.payload?.buttonId !== undefined
  }
  return false
}

async function sleep(ms: number): Promise<boolean> {
  await new Promise<void>((resolve) => setTimeout(resolve, Math.max(ms | 0, 0)))
  return true
}
