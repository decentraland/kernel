import { LoadableAPIs } from '../../shared/apis/client'
import { initMessagesFinished, numberToIdStore, resolveMapping } from './Utils'
import { LoadableParcelScene } from 'shared/types'
import { customEval, getES5Context } from './sandbox'
import { createFetch } from './Fetch'
import { createWebSocket } from './WebSocket'
import { RpcClient } from '@dcl/rpc/dist/types'
import { PermissionItem } from 'shared/apis/proto/Permissions.gen'

import { createDecentralandInterface } from './runtime/DecentralandInterface'
import { setupFpsThrottling } from './runtime/SetupFpsThrottling'

import { DevToolsAdapter } from './runtime/DevToolsAdapter'
import type { EntityAction, PullEventsResponse } from 'shared/apis/proto/EngineAPI.gen'
import { RuntimeEventCallback, RuntimeEvent, SceneRuntimeEventState, EventDataToRuntimeEvent } from './runtime/Events'

export async function startSceneRuntime(client: RpcClient) {
  const workerName = self.name
  const clientPort = await client.createPort(`scene-${workerName}`)

  const [EngineAPI, EnvironmentAPI, Permissions, DevTools] = await Promise.all([
    LoadableAPIs.EngineAPI(clientPort),
    LoadableAPIs.EnvironmentAPI(clientPort),
    LoadableAPIs.Permissions(clientPort),
    LoadableAPIs.DevTools(clientPort)
  ])

  const devToolsAdapter = new DevToolsAdapter(DevTools)
  const eventState: SceneRuntimeEventState = { allowOpenExternalUrl: false }
  const onEventFunctions: RuntimeEventCallback[] = []

  function eventReceiver(event: RuntimeEvent) {
    if (event.type === 'raycastResponse') {
      const idAsNumber = parseInt(event.data.queryId, 10)
      if (numberToIdStore[idAsNumber]) {
        event.data.queryId = numberToIdStore[idAsNumber].toString()
      }
    }

    if (isPointerEvent(event)) {
      eventState.allowOpenExternalUrl = true
    }
    for (const cb of onEventFunctions) {
      try {
        cb(event)
      } catch (err) {
        console.error(err, { event })
      }
    }
    eventState.allowOpenExternalUrl = false
  }

  const bootstrapData = await EnvironmentAPI.getBootstrapData()
  const fullData = bootstrapData.data as LoadableParcelScene
  const isPreview = await EnvironmentAPI.isPreviewMode()

  if (!bootstrapData || !bootstrapData.main) {
    throw new Error(`No boostrap data`)
  }

  const mappingName = bootstrapData.main
  const mapping = bootstrapData.mappings.find(($) => $.file === mappingName)
  const url = resolveMapping(mapping && mapping.hash, mappingName, bootstrapData.baseUrl)
  const codeRequest = await fetch(url)

  if (!codeRequest.ok) {
    EngineAPI.sendBatch({ actions: [initMessagesFinished()] }).catch((err) => devToolsAdapter.error(err))
    throw new Error(
      `SDK: Error while loading ${url} (${mappingName} -> ${mapping?.file}:${mapping?.hash}) the mapping was not found`
    )
  }

  const sourceCode = await codeRequest.text()

  const batchEvents: { events: EntityAction[] } = {
    events: []
  }

  const { dcl, onUpdateFunctions, onStartFunctions } = createDecentralandInterface({
    clientPort,
    onError: (err: Error) => devToolsAdapter.error(err),
    onLog: (...args: any) => devToolsAdapter.log(...args),
    onEventFunctions,
    sceneId: bootstrapData.sceneId,
    eventState,
    batchEvents
  })

  const [canUseWebsocket, canUseFetch] = (
    await Permissions.hasManyPermissions({
      permissions: [PermissionItem.USE_WEBSOCKET, PermissionItem.USE_FETCH]
    })
  ).hasManyPermission

  const unsafeAllowed = await EnvironmentAPI.areUnsafeRequestAllowed()

  const originalFetch = fetch

  const restrictedWebSocket = createWebSocket({
    canUseWebsocket,
    previewMode: isPreview || unsafeAllowed,
    log: dcl.log
  })
  const restrictedFetch = createFetch({
    canUseFetch,
    originalFetch: originalFetch,
    previewMode: isPreview || unsafeAllowed,
    log: dcl.log
  })

  globalThis.fetch = restrictedFetch
  globalThis.WebSocket = restrictedWebSocket

  let didStart = false
  onEventFunctions.push((event) => {
    if (event.type === 'sceneStart' && !didStart) {
      didStart = true
      for (const startFunctionCb of onStartFunctions) {
        try {
          startFunctionCb()
        } catch (e: any) {
          devToolsAdapter.error(e)
        }
      }
      startLoop().catch((err) => devToolsAdapter.error(err))
    }
  })

  const env = { dcl, WebSocket: restrictedWebSocket, fetch: restrictedFetch }
  await customEval(sourceCode, getES5Context(env))

  batchEvents.events.push(initMessagesFinished())

  await sendBatch()

  async function sendBatch() {
    if (batchEvents.events.length) {
      const batch = batchEvents.events
      batchEvents.events = []

      EngineAPI.sendBatch({ actions: batch }).catch((err) => devToolsAdapter.error(err))
    }
  }

  let updateInterval: number = 1000 / 30
  if (bootstrapData.useFPSThrottling === true) {
    setupFpsThrottling(dcl, fullData.parcels, (newValue) => {
      updateInterval = newValue
    })
  }

  /**
   * Handle the pull events response calling the eventReceiver
   */
  function processEvents(req: PullEventsResponse) {
    for (const e of req.events) {
      eventReceiver(EventDataToRuntimeEvent(e))
    }
  }

  /**
   * Forever loop until the worker is killed
   */
  async function startLoop() {
    let start = performance.now()

    while (true) {
      const frameBeginingTime = performance.now()
      const events = await EngineAPI.pullEvents({})
      processEvents(events)

      const now = performance.now()
      const dt = now - start
      start = now

      const time = dt / 1000

      for (const trigger of onUpdateFunctions) {
        try {
          trigger(time)
        } catch (e: any) {
          devToolsAdapter.error(e)
        }
      }

      await sendBatch().catch((err) => devToolsAdapter.error(err))

      // At least 10ms of releasing
      const realInterval = updateInterval - (performance.now() - frameBeginingTime)

      if (realInterval > 0) {
        await new Promise((resolve) => setTimeout(resolve, realInterval))
      }
    }
  }

  /**
   * This pull the events until the sceneStart event is emitted
   */
  async function waitToStart() {
    if (!didStart) {
      try {
        processEvents(await EngineAPI.pullEvents({}))
      } catch (err: any) {
        devToolsAdapter.error(err)
      }
      setTimeout(waitToStart, 1000 / 30)
    }
  }

  waitToStart().catch(devToolsAdapter.error)
}

function isPointerEvent(event: RuntimeEvent): boolean {
  switch (event.type) {
    case 'uuidEvent':
      return event.data?.payload?.buttonId !== undefined
  }
  return false
}
