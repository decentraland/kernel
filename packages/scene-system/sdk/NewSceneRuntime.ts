import { LoadableAPIs } from './../../shared/apis/client'
import { initMessagesFinished, resolveMapping } from './Utils'
import { LoadableParcelScene } from 'shared/types'
import { customEval, getES5Context } from './sandbox'
import { createFetch } from './Fetch'
import { createWebSocket } from './WebSocket'
import { RpcClient } from '@dcl/rpc/dist/types'
import { PermissionItem } from 'shared/apis/proto/Permissions'

// New
import { setupStats } from './new-rpc/Stats'
import { createDecentralandInterface } from './new-rpc/DecentralandInterface'
import { setupFpsThrottling } from './new-rpc/SetupFpsThrottling'
import { createEventDispatcher, EventCallback, EventState } from './new-rpc/EventDispatcher'
import { DevToolsAdapter } from './new-rpc/DevToolsAdapter'
import type { EntityAction } from 'shared/apis/proto/EngineAPI'

export async function startNewSceneRuntime(client: RpcClient) {
  const clientPort = await client.createPort(`new-rpc-${globalThis.name}`)

  const [EngineAPI, EnvironmentAPI, Permissions, DevTools] = await Promise.all([
    LoadableAPIs.EngineAPI(clientPort),
    LoadableAPIs.EnvironmentAPI(clientPort),
    LoadableAPIs.Permissions(clientPort),
    LoadableAPIs.DevTools(clientPort)
  ])

  const devToolsAdapter = new DevToolsAdapter(DevTools)
  setupStats((...args: any[]) => devToolsAdapter.log(...args))

  const eventState: EventState = { allowOpenExternalUrl: false }
  const onEventFunctions: EventCallback[] = []
  createEventDispatcher(EngineAPI, { onEventFunctions, eventState }).catch((err) => devToolsAdapter.error(err))

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
    throw new Error(`SDK: Error while loading ${url} (${mappingName} -> ${mapping}) the mapping was not found`)
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

  // TODO: aquire permissions using a single call
  const canUseWebsocket = (await Permissions.hasPermission({ permission: PermissionItem.USE_WEBSOCKET }))
    .hasPermission
  const canUseFetch = (await Permissions.hasPermission({ permission: PermissionItem.USE_FETCH })).hasPermission
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

  onEventFunctions.push((event) => {
    if (event.type === 'sceneStart') {
      startLoop().catch((err) => devToolsAdapter.error(err))
      for (const startFunctionCb of onStartFunctions) {
        try {
          startFunctionCb()
        } catch (e: any) {
          devToolsAdapter.error(e)
        }
      }
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

  async function startLoop() {
    let start = performance.now()

    const update = () => {
      const now = performance.now()
      const dt = now - start
      start = now

      setTimeout(update, updateInterval)

      const time = dt / 1000

      for (const trigger of onUpdateFunctions) {
        try {
          trigger(time)
        } catch (e: any) {
          devToolsAdapter.error(e)
        }
      }

      sendBatch().catch((err) => devToolsAdapter.error(err))
    }

    update()
  }
}
