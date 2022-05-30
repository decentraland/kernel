import { createEnvironmentAPIServiceClient } from 'shared/apis/EnvironmentAPI'
import { createEngineAPIServiceClient } from 'shared/apis/EngineAPI'
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
  SetEntityParentPayload,
  UpdateEntityComponentPayload
} from 'shared/types'
import { QueryType } from '@dcl/legacy-ecs'
import { customEval, getES5Context } from './sandbox'
import { createFetch } from './Fetch'
import { createWebSocket } from './WebSocket'
import { ClientModuleDefinition, RpcClient } from '@dcl/rpc/dist/types'

interface DecentralandInterfaceOptions {
  onLog: (...args: any[]) => void
  onError: (...args: any[]) => void
  events: any[]
  allowOpenExternalUrl: boolean
  onUpdateFunctions: any[]
  onEventFunctions: any[]
  onStartFunctions: any[]
  sceneId: string
  subscribedEvents: Map<string, boolean>
  subscribe: (id: string, cb: (data: any) => void) => Promise<void>
  fireEvent: (event: any) => void
}

function getDecentralandInterface(options: DecentralandInterfaceOptions): DecentralandInterface {
  const {
    onLog,
    onError,
    events,
    allowOpenExternalUrl,
    onUpdateFunctions,
    sceneId,
    onEventFunctions,
    subscribedEvents,
    onStartFunctions,
    subscribe,
    fireEvent
  } = options

  return {
    DEBUG: true,
    log(...args: any[]) {
      onLog(...args)
    },

    openExternalUrl(url: string) {
      if (JSON.stringify(url).length > 49000) {
        onError(new Error('URL payload cannot exceed 49.000 bytes'))
        return
      }

      if (allowOpenExternalUrl) {
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
      if (allowOpenExternalUrl) {
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
      if (!subscribedEvents.has(eventName)) {
        subscribedEvents.set(eventName, true)

        subscribe(eventName, (event) => {
          if (eventName === 'raycastResponse') {
            const idAsNumber = parseInt(event.data.queryId, 10)
            if (numberToIdStore[idAsNumber]) {
              event.data.queryId = numberToIdStore[idAsNumber].toString()
            }
          }
          fireEvent({ type: eventName, data: event })
        }).catch((error) => console.error(error))
      }
    },

    /** unsubscribe to specific event */
    unsubscribe(eventName: string): void {
      subscribedEvents.delete(eventName)
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
      // const loadingModule: IFuture<void> = future()
      // loadingModules[_moduleName] = loadingModule
      try {
        const moduleToLoad = _moduleName.replace(/^@decentraland\//, '')
        const methods: string[] = []
        // if (moduleToLoad === WEB3_PROVIDER) {
        //   methods.push(PROVIDER_METHOD)
        //   this.provider = await this.getEthereumProvider()
        // } else {
        //   const proxy = (await this.loadAPIs([moduleToLoad]))[moduleToLoad]
        //   try {
        //     methods = await proxy._getExposedMethods()
        //   } catch (e: any) {
        //     throw Object.assign(new Error(`Error getting the methods of ${moduleToLoad}: ` + e.message), {
        //       original: e
        //     })
        //   }
        // }
        return {
          rpcHandle: moduleToLoad,
          methods: methods.map((name) => ({ name }))
        }
      } finally {
        // loadingModule.resolve()
      }
    },
    callRpc: async (rpcHandle: string, methodName: string, args: any[]) => {
      // if (rpcHandle === WEB3_PROVIDER && methodName === PROVIDER_METHOD) {
      //   return this.provider
      // }
      // const module = this.loadedAPIs[rpcHandle]
      // if (!module) {
      //   throw new Error(`RPCHandle: ${rpcHandle} is not loaded`)
      // }
      // // eslint-disable-next-line prefer-spread
      // return module[methodName].apply(module, args)
      return {}
    },
    onStart(cb: () => void) {
      onStartFunctions.push(cb)
    },
    error(message, data) {
      onError(Object.assign(new Error(message as string), { data }))
    }
  }
}

function initMessagesFinished() {
  return {
    type: 'InitMessagesFinished',
    tag: 'scene',
    payload: '{}'
  }
}

export async function startNewSceneRuntime(client: RpcClient) {
  debugger

  const clientPort = await client.createPort('new-ecs-scene-worker')
  const environmentApiService = await createEnvironmentAPIServiceClient(clientPort)
  const engineApiService = await createEngineAPIServiceClient(clientPort)

  const bootstrapData = await environmentApiService.getBootstrapData({})
  const isPreview = (await environmentApiService.isPreviewMode({})).isPreview

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

  const events: any = []
  let allowOpenExternalUrl = false
  const onUpdateFunctions: ((dt: number) => void)[] = []
  const onEventFunctions: ((event: any) => void)[] = []
  const onStartFunctions: (() => void)[] = []

  async function subscribe(id: string, cb: (data: any) => void) {
    for await (const notif of engineApiService.subscribe({ id })) {
      cb(JSON.parse(notif.payload || '{}'))
    }
  }

  function fireEvent(event: any) {
    try {
      if (isPointerEvent(event)) {
        allowOpenExternalUrl = true
      }
      for (const trigger of onEventFunctions) {
        trigger(event)
      }
    } catch (e: any) {
      console.error(e)
    }
    allowOpenExternalUrl = false
  }

  const dcl = getDecentralandInterface({
    onLog: (...args: any[]) => {
      console.log(...args)
    },
    onError: (...args: any[]) => {
      console.error(...args)
    },
    events,
    allowOpenExternalUrl,
    onUpdateFunctions,
    onEventFunctions,
    onStartFunctions,
    sceneId: bootstrapData.sceneId,
    subscribedEvents: new Map<string, boolean>(),
    subscribe,
    fireEvent
  })

  dcl.callRpc = async (rpcHandle: string, methodName: string, args: any[]) => {
    console.log({ rpcHandle, methodName, args })
  }
  dcl.loadModule = async (moduleName: string, exportsRef: any): Promise<ModuleDescriptor> => {
    try {
      const module = (await clientPort.loadModule(moduleName)) as ClientModuleDefinition

      return {
        rpcHandle: moduleName,
        methods: Object.keys(module).map((key) => ({ name: 'hello-world' }))
      }
    } catch (err) {}

    console.log({ moduleName, exportsRef })
    return {
      rpcHandle: 'module',
      methods: [{ name: 'hello-world' }]
    }
  }

  // const { Permissions } = await this.loadAPIs(['Permissions'])
  const canUseWebsocket = true // await Permissions.hasPermission(PermissionItem.USE_WEBSOCKET)
  const canUseFetch = true // await Permissions.hasPermission(PermissionItem.USE_FETCH)
  // const { EnvironmentAPI } = (await this.loadAPIs(['EnvironmentAPI'])) as { EnvironmentAPI: IEnvironmentAPI }
  const unsafeAllowed = (await environmentApiService.areUnsafeRequestAllowed({})).status

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

  const env = { dcl, WebSocket: restrictedWebSocket, fetch: restrictedFetch }

  async function onStart() {
    await engineApiService.subscribe({ id: 'sceneStart' })
    startLoop().catch((err) => console.error(err))

    onStartFunctions.forEach(($) => {
      try {
        $()
      } catch (e: any) {
        console.error(e)
      }
    })
  }

  onStart().catch((err) => console.error(err))

  await customEval(sourceCode, getES5Context(env))

  events.push(initMessagesFinished())

  onStartFunctions.push(() => {
    engineApiService.startSignal({}).catch((e) => {
      console.error(e)
    })
  })

  await engineApiService.sendBatch({ actions: events })

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

      engineApiService.sendBatch({ actions: events }).catch((err) => console.error(err))
    }

    update()
  }
}

function isPointerEvent(event: any): boolean {
  switch (event.type) {
    case 'uuidEvent':
      return event.data.payload.buttonId !== undefined
  }
  return false
}
