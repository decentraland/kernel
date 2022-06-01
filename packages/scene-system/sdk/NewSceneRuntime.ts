import { LoadedModules, LoadableAPIs } from './../../shared/apis/client'
import { initMessagesFinished, resolveMapping } from './Utils'
import { LoadableParcelScene } from 'shared/types'
import { customEval, getES5Context } from './sandbox'
import { createFetch } from './Fetch'
import { createWebSocket } from './WebSocket'
import { RpcClient } from '@dcl/rpc/dist/types'
import { PermissionItem } from 'shared/apis/gen/Permissions'
import { sleep } from 'atomicHelpers/sleep'

// New
import { addStat, setupStats } from './new-rpc/Stats'
import { createDecentralandInterface } from './new-rpc/DecentralandInterface'
import { setupFpsThrottling } from './new-rpc/SetupFpsThrottling'
import { createEventTracker, EventCallback, EventState } from './new-rpc/EventTracker'
import { DevToolsAdapter } from './new-rpc/DevToolsAdapter'

export async function startNewSceneRuntime(client: RpcClient) {
  const clientPort = await client.createPort(`new-rpc-${globalThis.name}`)
  const modules: LoadedModules = {
    EngineAPI: await LoadableAPIs.EngineAPI(clientPort),
    EnvironmentAPI: await LoadableAPIs.EnvironmentAPI(clientPort),
    Permissions: await LoadableAPIs.Permissions(clientPort),
    DevTools: await LoadableAPIs.DevTools(clientPort)
  }

  const devToolsAdapter = new DevToolsAdapter(modules.DevTools)
  setupStats((...args: any[]) => devToolsAdapter.log(...args))

  const eventState: EventState = { allowOpenExternalUrl: false }
  const onEventFunctions: EventCallback[] = []
  createEventTracker(modules.EngineAPI!, { onEventFunctions, eventState }).catch((err) => devToolsAdapter.error(err))

  const bootstrapData = await modules.EnvironmentAPI!.realGetBootstrapData({})
  const fullData = JSON.parse(bootstrapData.jsonPayload) as LoadableParcelScene
  const isPreview = (await modules.EnvironmentAPI!.realIsPreviewMode({})).isPreview

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

  const { dcl, onUpdateFunctions, onStartFunctions, events, loadingModules } = createDecentralandInterface({
    modules,
    clientPort,
    onError: (err: Error) => devToolsAdapter.error(err),
    onLog: (...args: any) => devToolsAdapter.log(...args),
    onEventFunctions,
    sceneId: bootstrapData.sceneId,
    eventState
  })

  const canUseWebsocket = (await modules.Permissions!.realHasPermission({ permission: PermissionItem.USE_WEBSOCKET }))
    .hasPermission
  const canUseFetch = (await modules.Permissions!.realHasPermission({ permission: PermissionItem.USE_FETCH }))
    .hasPermission
  const unsafeAllowed = (await modules.EnvironmentAPI!.realAreUnsafeRequestAllowed({})).status

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

  onStartFunctions.push(() => {
    modules.EngineAPI!.startSignal({}).catch((e) => {
      devToolsAdapter.error(e)
    })
  })

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

  let modulesNotLoaded: string[] = []

  const timeout = sleep(10000).then(() => {
    modulesNotLoaded = Object.keys(loadingModules).filter((it) => loadingModules[it].isPending)
  })

  await Promise.race([Promise.all(Object.values(loadingModules)), timeout])

  if (modulesNotLoaded.length > 0) {
    devToolsAdapter.log(
      `Timed out loading modules!. The scene ${bootstrapData.sceneId} may not work correctly. Modules not loaded: ${modulesNotLoaded}`
    )
  }

  events.push(initMessagesFinished())

  await sendBatch()

  async function sendBatch() {
    if (events.length) {
      const batch = events.slice()
      events.length = 0

      addStat(
        'sendBatch',
        batch.length,
        batch.reduce((prev, current) => prev + current.payload.length, 0)
      )

      modules.EngineAPI!.sendBatch({ actions: batch }).catch((err) => devToolsAdapter.error(err))
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
