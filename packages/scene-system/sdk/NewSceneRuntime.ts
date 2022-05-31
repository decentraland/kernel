import { LoadedModules, LoadableAPIs } from './../../shared/apis/client'
import { componentNameRE, generatePBObject, getIdAsNumber, numberToIdStore, resolveMapping } from './Utils'
import {
  AttachEntityComponentPayload,
  ComponentCreatedPayload,
  ComponentDisposedPayload,
  ComponentRemovedPayload,
  ComponentUpdatedPayload,
  CreateEntityPayload,
  OpenNFTDialogPayload,
  QueryPayload,
  RemoveEntityPayload,
  RPCSendableMessage,
  SetEntityParentPayload,
  UpdateEntityComponentPayload
} from 'shared/types'
import { QueryType } from '@dcl/legacy-ecs'
import { customEval, getES5Context } from './sandbox'
import { createFetch } from './Fetch'
import { createWebSocket } from './WebSocket'
import { RpcClient, RpcClientPort } from '@dcl/rpc/dist/types'
import { PermissionItem } from 'shared/apis/gen/Permissions'
import future, { IFuture } from 'fp-future'

const WEB3_PROVIDER = 'web3-provider'
const PROVIDER_METHOD = 'getProvider'

type EventState = { allowOpenExternalUrl: boolean }
type EventCallback = (event: { type: string; data: any }) => void

interface DecentralandInterfaceOptions {
  modules: LoadedModules
  onLog: (...args: any[]) => void
  onError: (...args: any[]) => void
  onEventFunctions: EventCallback[]
  sceneId: string
  clientPort: RpcClientPort
  eventState: EventState
}

async function getEthereumProvider(modules: LoadedModules, port: RpcClientPort) {
  modules.EthereumController = await LoadableAPIs.EthereumController(port)

  return {
    // @internal
    send(message: RPCSendableMessage, callback?: (error: Error | null, result?: any) => void): void {
      if (message && callback && callback instanceof Function) {
        modules
          .EthereumController!.sendAsync(message)
          .then((x: any) => callback(null, x))
          .catch(callback)
      } else {
        throw new Error('Decentraland provider only allows async calls')
      }
    },
    sendAsync(message: RPCSendableMessage, callback: (error: Error | null, result?: any) => void): void {
      modules
        .EthereumController!.sendAsync(message)
        .then((x: any) => callback(null, x))
        .catch(callback)
    }
  }
}

function getDecentralandInterface(options: DecentralandInterfaceOptions) {
  const { modules, onError, onLog, sceneId, onEventFunctions, clientPort, eventState } = options
  const events: any = []
  const onUpdateFunctions: ((dt: number) => void)[] = []
  const onStartFunctions: (() => void)[] = []
  const loadingModules: Record<string, IFuture<void>> = {}
  let provider: Awaited<ReturnType<typeof getEthereumProvider>> | null = null

  const dcl: DecentralandInterface = {
    DEBUG: true,
    log(...args: any[]) {
      onLog(...args)
    },

    openExternalUrl(url: string) {
      if (JSON.stringify(url).length > 49000) {
        onError(new Error('URL payload cannot exceed 49.000 bytes'))
        return
      }

      if (eventState.allowOpenExternalUrl) {
        events.push({
          type: 'OpenExternalUrl',
          tag: '',
          payload: JSON.stringify(url)
        })
      } else {
        this.error('openExternalUrl can only be used inside a pointerEvent')
      }
    },

    openNFTDialog(assetContractAddress: string, tokenId: string, comment: string | null) {
      if (eventState.allowOpenExternalUrl) {
        const payload = { assetContractAddress, tokenId, comment }

        if (JSON.stringify(payload).length > 49000) {
          onError(new Error('OpenNFT payload cannot exceed 49.000 bytes'))
          return
        }

        events.push({
          type: 'OpenNFTDialog',
          tag: '',
          payload: JSON.stringify(payload as OpenNFTDialogPayload)
        })
      } else {
        this.error('openNFTDialog can only be used inside a pointerEvent')
      }
    },

    addEntity(entityId: string) {
      if (entityId === '0') {
        // We dont create the entity 0 in the engine.
        return
      }
      events.push({
        type: 'CreateEntity',
        payload: JSON.stringify({ id: entityId } as CreateEntityPayload)
      })
    },

    removeEntity(entityId: string) {
      events.push({
        type: 'RemoveEntity',
        payload: JSON.stringify({ id: entityId } as RemoveEntityPayload)
      })
    },

    /** update tick */
    onUpdate(cb: (deltaTime: number) => void): void {
      if (typeof (cb as any) !== 'function') {
        onError(new Error('onUpdate must be called with only a function argument'))
      } else {
        onUpdateFunctions.push(cb)
      }
    },

    /** event from the engine */
    onEvent(cb: (event: any) => void): void {
      if (typeof (cb as any) !== 'function') {
        onError(new Error('onEvent must be called with only a function argument'))
      } else {
        onEventFunctions.push(cb)
      }
    },

    /** called after adding a component to the entity or after updating a component */
    updateEntityComponent(entityId: string, componentName: string, classId: number, json: string): void {
      if (json.length > 49000) {
        onError(new Error('Component payload cannot exceed 49.000 bytes'))
        return
      }

      if (componentNameRE.test(componentName)) {
        events.push({
          type: 'UpdateEntityComponent',
          tag: sceneId + '_' + entityId + '_' + classId,
          payload: JSON.stringify({
            entityId,
            classId,
            name: componentName.replace(componentNameRE, ''),
            json: generatePBObject(classId, json)
          } as UpdateEntityComponentPayload)
        })
      }
    },

    /** called after adding a DisposableComponent to the entity */
    attachEntityComponent(entityId: string, componentName: string, id: string): void {
      if (componentNameRE.test(componentName)) {
        events.push({
          type: 'AttachEntityComponent',
          tag: entityId,
          payload: JSON.stringify({
            entityId,
            name: componentName.replace(componentNameRE, ''),
            id
          } as AttachEntityComponentPayload)
        })
      }
    },

    /** call after removing a component from the entity */
    removeEntityComponent(entityId: string, componentName: string): void {
      if (componentNameRE.test(componentName)) {
        events.push({
          type: 'ComponentRemoved',
          tag: entityId,
          payload: JSON.stringify({
            entityId,
            name: componentName.replace(componentNameRE, '')
          } as ComponentRemovedPayload)
        })
      }
    },

    /** set a new parent for the entity */
    setParent(entityId: string, parentId: string): void {
      events.push({
        type: 'SetEntityParent',
        tag: entityId,
        payload: JSON.stringify({
          entityId,
          parentId
        } as SetEntityParentPayload)
      })
    },

    /** queries for a specific system with a certain query configuration */
    query(queryType: QueryType, payload: any) {
      payload.queryId = getIdAsNumber(payload.queryId).toString()
      events.push({
        type: 'Query',
        tag: sceneId + '_' + payload.queryId,
        payload: JSON.stringify({
          queryId: queryType,
          payload
        } as QueryPayload)
      })
    },

    /** subscribe to specific events, events will be handled by the onEvent function */
    subscribe(eventName: string): void {
      modules.EngineAPI?.realSubscribe({ eventId: eventName }).catch((err) => onError(err))

      // if (!subscribedEvents.has(eventName)) {
      //   subscribedEvents.set(eventName, true)
      //   subscribe(eventName, (event) => {
      //     if (eventName === 'raycastResponse') {
      //       const idAsNumber = parseInt(event.data.queryId, 10)
      //       if (numberToIdStore[idAsNumber]) {
      //         event.data.queryId = numberToIdStore[idAsNumber].toString()
      //       }
      //     }
      //     fireEvent({ type: eventName, data: event })
      //   }).catch((error) => console.error(error))
      // }
    },

    /** unsubscribe to specific event */
    unsubscribe(eventName: string): void {
      modules.EngineAPI?.realUnsubscribe({ eventId: eventName }).catch((err) => onError(err))
      // subscribedEvents.delete(eventName)
      // that.eventSubscriber.off(eventName)
    },

    componentCreated(id: string, componentName: string, classId: number) {
      if (componentNameRE.test(componentName)) {
        events.push({
          type: 'ComponentCreated',
          tag: id,
          payload: JSON.stringify({
            id,
            classId,
            name: componentName.replace(componentNameRE, '')
          } as ComponentCreatedPayload)
        })
      }
    },

    componentDisposed(id: string) {
      events.push({
        type: 'ComponentDisposed',
        tag: id,
        payload: JSON.stringify({ id } as ComponentDisposedPayload)
      })
    },

    componentUpdated(id: string, json: string) {
      events.push({
        type: 'ComponentUpdated',
        tag: id,
        payload: JSON.stringify({
          id,
          json
        } as ComponentUpdatedPayload)
      })
    },

    loadModule: async (_moduleName) => {
      const loadingModule: IFuture<void> = future()
      loadingModules[_moduleName] = loadingModule
      try {
        const moduleToLoad = _moduleName.replace(/^@decentraland\//, '')
        let methods: string[] = []

        if (moduleToLoad in LoadableAPIs) {
          ;(modules as any)[moduleToLoad] = await (LoadableAPIs as any)[moduleToLoad]
        }
        if (moduleToLoad === WEB3_PROVIDER) {
          methods.push(PROVIDER_METHOD)
          provider = await getEthereumProvider(modules, clientPort)
        } else {
          try {
            if (moduleToLoad in LoadableAPIs) {
              ;(modules as any)[moduleToLoad] = await (LoadableAPIs as any)[moduleToLoad]
            }
            methods = Object.keys((modules as any)[moduleToLoad])
          } catch (e: any) {
            throw Object.assign(new Error(`Error getting the methods of ${moduleToLoad}: ` + e.message), {
              original: e
            })
          }
        }
        return {
          rpcHandle: moduleToLoad,
          methods: methods.map((name) => ({ name }))
        }
      } finally {
        loadingModule.resolve()
      }
    },
    callRpc: async (rpcHandle: string, methodName: string, args: any[]) => {
      if (rpcHandle === WEB3_PROVIDER && methodName === PROVIDER_METHOD) {
        return provider
      }
      const module = (modules as any)[rpcHandle]
      if (!module) {
        throw new Error(`RPCHandle: ${rpcHandle} is not loaded`)
      }
      // eslint-disable-next-line prefer-spread
      return module[methodName].apply(module, args)
    },
    onStart(cb: () => void) {
      onStartFunctions.push(cb)
    },
    error(message, data) {
      onError(Object.assign(new Error(message as string), { data }))
    }
  }

  return {
    dcl,
    onStartFunctions,
    onUpdateFunctions,
    events,
    loadingModules
  }
}

function initMessagesFinished() {
  return {
    type: 'InitMessagesFinished',
    tag: 'scene',
    payload: '{}'
  }
}

async function eventTracker(
  EngineAPI: LoadedModules['EngineAPI'],
  eventArgs: { eventState: EventState; onEventFunctions: EventCallback[] }
) {
  for await (const notif of EngineAPI!.streamEvents({})) {
    console.log({ notif })
    const data = JSON.parse(notif.eventData || '{}')
    const event = { type: notif.eventId, data }
    if (event.type === 'raycastResponse') {
      const idAsNumber = parseInt(data.queryId, 10)
      if (numberToIdStore[idAsNumber]) {
        data.queryId = numberToIdStore[idAsNumber].toString()
      }
    }

    if (isPointerEvent(event)) {
      eventArgs.eventState.allowOpenExternalUrl = true
    }
    for (const cb of eventArgs.onEventFunctions) {
      try {
        cb(event)
      } catch (err) {
        console.error(err)
      }
    }
    eventArgs.eventState.allowOpenExternalUrl = false
  }
}

export async function startNewSceneRuntime(client: RpcClient) {
  const clientPort = await client.createPort('new-ecs-scene-worker')
  const modules: LoadedModules = {
    EngineAPI: await LoadableAPIs.EngineAPI(clientPort),
    EnvironmentAPI: await LoadableAPIs.EnvironmentAPI(clientPort),
    Permissions: await LoadableAPIs.Permissions(clientPort)
  }

  const eventState: EventState = { allowOpenExternalUrl: false }
  const onEventFunctions: EventCallback[] = []
  eventTracker(modules.EngineAPI!, { onEventFunctions, eventState }).catch((err) => console.error(err))

  const bootstrapData = await modules.EnvironmentAPI!.realGetBootstrapData({})
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

  const { dcl, onUpdateFunctions, onStartFunctions, events } = getDecentralandInterface({
    modules,
    clientPort,
    onError: (...args: any) => console.error(...args),
    onLog: (...args: any) => console.error(...args),
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
      console.error(e)
    })
  })

  onEventFunctions.push((event) => {
    if (event.type === 'sceneStart') {
      startLoop().catch((err) => console.error(err))
      for (const startFunctionCb of onStartFunctions) {
        try {
          startFunctionCb()
        } catch (e: any) {
          console.error(e)
        }
      }
    }
  })

  const env = { dcl, WebSocket: restrictedWebSocket, fetch: restrictedFetch }
  await customEval(sourceCode, getES5Context(env))

  events.push(initMessagesFinished())

  await modules.EngineAPI!.sendBatch({ actions: events })

  async function startLoop() {
    let start = performance.now()

    const update = () => {
      const now = performance.now()
      const dt = now - start
      start = now

      setTimeout(update, 100)

      const time = dt / 1000

      for (const trigger of onUpdateFunctions) {
        try {
          trigger(time)
        } catch (e: any) {
          console.error(e)
        }
      }

      modules.EngineAPI!.sendBatch({ actions: events }).catch((err) => console.error(err))
    }

    update()
  }
}

function isPointerEvent(event: any): boolean {
  switch (event.type) {
    case 'uuidEvent':
      return event.data?.payload?.buttonId !== undefined
  }
  return false
}

// private setupFpsThrottling(dcl: DecentralandInterface) {
//   dcl.subscribe('positionChanged')
//   dcl.onEvent((event) => {
//     if (event.type !== 'positionChanged') {
//       return
//     }

//     const e = event.data as IEvents['positionChanged']

//     //NOTE: calling worldToGrid from parcelScenePositions.ts here crashes kernel when there are 80+ workers since chrome 92.
//     const PARCEL_SIZE = 16
//     const playerPosition = new Vector2(
//       Math.floor(e.cameraPosition.x / PARCEL_SIZE),
//       Math.floor(e.cameraPosition.z / PARCEL_SIZE)
//     )

//     if (playerPosition === undefined || this.scenePosition === undefined) {
//       return
//     }

//     const playerPos = playerPosition as Vector2
//     const scenePos = this.scenePosition

//     let sqrDistanceToPlayerInParcels = 10 * 10
//     let isInsideScene = false

//     if (!!this.parcels) {
//       for (const parcel of this.parcels) {
//         sqrDistanceToPlayerInParcels = Math.min(
//           sqrDistanceToPlayerInParcels,
//           Vector2.DistanceSquared(playerPos, parcel)
//         )
//         if (parcel.x === playerPos.x && parcel.y === playerPos.y) {
//           isInsideScene = true
//         }
//       }
//     } else {
//       sqrDistanceToPlayerInParcels = Vector2.DistanceSquared(playerPos, scenePos)
//       isInsideScene = scenePos.x === playerPos.x && scenePos.y === playerPos.y
//     }

//     let fps: number = 1

//     if (isInsideScene) {
//       fps = 30
//     } else if (sqrDistanceToPlayerInParcels <= 2 * 2) {
//       // NOTE(Brian): Yes, this could be a formula, but I prefer this pedestrian way as
//       //              its easier to read and tweak (i.e. if we find out its better as some arbitrary curve, etc).
//       fps = 20
//     } else if (sqrDistanceToPlayerInParcels <= 3 * 3) {
//       fps = 10
//     } else if (sqrDistanceToPlayerInParcels <= 4 * 4) {
//       fps = 5
//     }

//     this.updateInterval = 1000 / fps
//   })
// }

// calculateSceneCenter(parcels: Array<{ x: number; y: number }>): Vector2 {
//   let center: Vector2 = new Vector2()

//   parcels.forEach((v2) => {
//     center = Vector2.Add(v2, center)
//   })

//   center.x /= parcels.length
//   center.y /= parcels.length

//   return center
// }
