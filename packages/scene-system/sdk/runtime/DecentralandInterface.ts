import { LoadableAPIs } from '../../../shared/apis/client'
import { componentNameRE, generatePBObject, getIdAsNumber } from '../Utils'
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
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { RuntimeEventCallback, EventState } from './EventDispatcher'
import { EntityAction } from 'shared/apis/proto/EngineAPI.gen'

export interface DecentralandInterfaceOptions {
  onLog: (...args: any[]) => void
  onError: (e: Error) => void
  onEventFunctions: RuntimeEventCallback[]
  sceneId: string
  clientPort: RpcClientPort
  eventState: EventState
  batchEvents: { events: EntityAction[] }
}

type GenericRpcModule = Record<string, (...args: any) => Promise<unknown>>
type ComposedRpcModule = ModuleDescriptor & { __INTERNAL_UNSAFE_loadedModule: GenericRpcModule }

export function createDecentralandInterface(options: DecentralandInterfaceOptions) {
  const { batchEvents, onError, onLog, sceneId, onEventFunctions, clientPort, eventState } = options

  const EngineAPI = LoadableAPIs.EngineAPI(clientPort)

  const onUpdateFunctions: ((dt: number) => void)[] = []
  const onStartFunctions: (() => void)[] = []
  const sceneLoadedModules: Record<string, ComposedRpcModule> = {}

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
        batchEvents.events.push({
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

        batchEvents.events.push({
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
      batchEvents.events.push({
        type: 'CreateEntity',
        payload: JSON.stringify({ id: entityId } as CreateEntityPayload)
      })
    },

    removeEntity(entityId: string) {
      batchEvents.events.push({
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
        batchEvents.events.push({
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
        batchEvents.events.push({
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
        batchEvents.events.push({
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
      batchEvents.events.push({
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
      batchEvents.events.push({
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
      EngineAPI.subscribe({ eventId: eventName }).catch((err: Error) => onError(err))
    },

    /** unsubscribe to specific event */
    unsubscribe(eventName: string): void {
      EngineAPI.unsubscribe({ eventId: eventName }).catch((err: Error) => onError(err))
    },

    componentCreated(id: string, componentName: string, classId: number) {
      if (componentNameRE.test(componentName)) {
        batchEvents.events.push({
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
      batchEvents.events.push({
        type: 'ComponentDisposed',
        tag: id,
        payload: JSON.stringify({ id } as ComponentDisposedPayload)
      })
    },

    componentUpdated(id: string, json: string) {
      batchEvents.events.push({
        type: 'ComponentUpdated',
        tag: id,
        payload: JSON.stringify({
          id,
          json
        } as ComponentUpdatedPayload)
      })
    },

    loadModule: async (_moduleName) => {
      if (!(_moduleName in sceneLoadedModules)) {
        const loadedModule = loadSceneModule(clientPort, _moduleName)
        sceneLoadedModules[_moduleName] = {
          rpcHandle: _moduleName,
          __INTERNAL_UNSAFE_loadedModule: loadedModule,
          methods: Object.keys(loadedModule).map((name) => ({ name }))
        }
      }

      return sceneLoadedModules[_moduleName]
    },
    callRpc: async (rpcHandle: string, methodName: string, args: any[]) => {
      const module = sceneLoadedModules[rpcHandle]
      if (!module) {
        throw new Error(`RPCHandle: ${rpcHandle} is not loaded`)
      }
      // eslint-disable-next-line prefer-spread
      return module.__INTERNAL_UNSAFE_loadedModule[methodName].apply(module, args)
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
    onUpdateFunctions
  }
}

function loadSceneModule(clientPort: RpcClientPort, moduleName: string): GenericRpcModule {
  const moduleToLoad = moduleName.replace(/^@decentraland\//, '')
  try {
    if (moduleToLoad in LoadableAPIs) {
      return (LoadableAPIs as any)[moduleToLoad](clientPort)
    } else {
      throw new Error('The module is not available in the list!')
    }
  } catch (e: any) {
    throw Object.assign(new Error(`Error getting the methods of ${moduleToLoad}: ` + e.message), {
      original: e
    })
  }
}
