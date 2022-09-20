import { LoadableAPIs } from '../../../shared/apis/client'
import { componentNameRE, generatePBObject, getIdAsNumber } from '../Utils'
import type { QueryType } from '@dcl/legacy-ecs'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { RuntimeEventCallback } from './Events'
import {
  EAType,
  EngineAPIServiceDefinition,
  EntityAction,
  queryTypeFromJSON
} from 'shared/protocol/kernel/apis/EngineAPI.gen'
import { SceneRuntimeEventState } from './Events'
import { RpcClientModule } from '@dcl/rpc/dist/codegen'

export interface DecentralandInterfaceOptions {
  onLog: (...args: any[]) => void
  onError: (e: Error) => void
  onEventFunctions: RuntimeEventCallback[]
  sceneId: string
  clientPort: RpcClientPort
  eventState: SceneRuntimeEventState
  batchEvents: { events: EntityAction[] }
  onStartFunctions: (() => void)[]
  onUpdateFunctions: ((dt: number) => void)[]
  EngineAPI: RpcClientModule<EngineAPIServiceDefinition>
}

type GenericRpcModule = Record<string, (...args: any) => Promise<unknown>>
type ComposedRpcModule = ModuleDescriptor & { __INTERNAL_UNSAFE_loadedModule: GenericRpcModule }

export function createDecentralandInterface(options: DecentralandInterfaceOptions) {
  const { batchEvents, onError, onLog, sceneId, onEventFunctions, clientPort, eventState } = options

  const sceneLoadedModules: Record<string, ComposedRpcModule> = {}

  const dcl: DecentralandInterface = {
    DEBUG: true,
    log(...args: any[]) {
      onLog(...args)
    },

    openExternalUrl(url: string) {
      try {
        const u = new URL(url)
        if (u.protocol !== 'https:') throw new Error('Only https: external links are allowed')
      } catch (err: any) {
        onError(err)
        return
      }

      if (JSON.stringify(url).length > 49000) {
        onError(new Error('URL payload cannot exceed 49.000 bytes'))
        return
      }

      if (eventState.allowOpenExternalUrl) {
        batchEvents.events.push({
          type: EAType.OpenExternalUrl,
          tag: '',
          payload: { openExternalUrl: { url } }
        })
      } else {
        this.error('openExternalUrl can only be used inside a pointerEvent')
      }
    },

    openNFTDialog(assetContractAddress: string, tokenId: string, comment: string | null) {
      if (eventState.allowOpenExternalUrl) {
        const payloadLength = assetContractAddress.length + tokenId.length + (comment?.length || 0)

        if (payloadLength > 49000) {
          onError(new Error('OpenNFT payload cannot exceed 49.000 bytes'))
          return
        }

        batchEvents.events.push({
          type: EAType.OpenNFTDialog,
          tag: '',
          payload: { openNftDialog: { assetContractAddress, tokenId, comment: comment || '' } }
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
        type: EAType.CreateEntity,
        payload: { createEntity: { id: entityId } }
      })
    },

    removeEntity(entityId: string) {
      batchEvents.events.push({
        type: EAType.RemoveEntity,
        payload: { removeEntity: { id: entityId } }
      })
    },

    /** update tick */
    onUpdate(cb: (deltaTime: number) => void): void {
      if (typeof (cb as any) !== 'function') {
        onError(new Error('onUpdate must be called with only a function argument'))
      } else {
        options.onUpdateFunctions.push(cb)
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
          type: EAType.UpdateEntityComponent,
          tag: sceneId + '_' + entityId + '_' + classId,
          payload: {
            updateEntityComponent: {
              entityId,
              classId,
              name: componentName.replace(componentNameRE, ''),
              json: generatePBObject(classId, json)
            }
          }
        })
      }
    },

    /** called after adding a DisposableComponent to the entity */
    attachEntityComponent(entityId: string, componentName: string, id: string): void {
      if (componentNameRE.test(componentName)) {
        batchEvents.events.push({
          type: EAType.AttachEntityComponent,
          tag: entityId,
          payload: {
            attachEntityComponent: {
              entityId,
              name: componentName.replace(componentNameRE, ''),
              id
            }
          }
        })
      }
    },

    /** call after removing a component from the entity */
    removeEntityComponent(entityId: string, componentName: string): void {
      if (componentNameRE.test(componentName)) {
        batchEvents.events.push({
          type: EAType.ComponentRemoved,
          tag: entityId,
          payload: {
            componentRemoved: {
              entityId,
              name: componentName.replace(componentNameRE, '')
            }
          }
        })
      }
    },

    /** set a new parent for the entity */
    setParent(entityId: string, parentId: string): void {
      batchEvents.events.push({
        type: EAType.SetEntityParent,
        tag: entityId,
        payload: {
          setEntityParent: {
            entityId,
            parentId
          }
        }
      })
    },

    /** queries for a specific system with a certain query configuration */
    query(queryType: QueryType, payload: any) {
      payload.queryId = getIdAsNumber(payload.queryId).toString()
      batchEvents.events.push({
        type: EAType.Query,
        tag: sceneId + '_' + payload.queryId,
        payload: {
          query: {
            queryId: queryTypeFromJSON(queryType),
            payload: JSON.stringify(payload)
          }
        }
      })
    },

    /** subscribe to specific events, events will be handled by the onEvent function */
    subscribe(eventName: string): void {
      options.EngineAPI.subscribe({ eventId: eventName }).catch((err: Error) => onError(err))
    },

    /** unsubscribe to specific event */
    unsubscribe(eventName: string): void {
      options.EngineAPI.unsubscribe({ eventId: eventName }).catch((err: Error) => onError(err))
    },

    componentCreated(id: string, componentName: string, classId: number) {
      if (componentNameRE.test(componentName)) {
        batchEvents.events.push({
          type: EAType.ComponentCreated,
          tag: id,
          payload: {
            componentCreated: {
              id,
              classId,
              name: componentName.replace(componentNameRE, '')
            }
          }
        })
      }
    },

    componentDisposed(id: string) {
      batchEvents.events.push({
        type: EAType.ComponentDisposed,
        tag: id,
        payload: {
          componentDisposed: { id }
        }
      })
    },

    componentUpdated(id: string, json: string) {
      batchEvents.events.push({
        type: EAType.ComponentUpdated,
        tag: id,
        payload: {
          componentUpdated: {
            id,
            json
          }
        }
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
      options.onStartFunctions.push(cb)
    },
    error(message, data) {
      onError(Object.assign(new Error(message as string), { data }))
    }
  }

  return dcl
}

function loadSceneModule(clientPort: RpcClientPort, moduleName: string): GenericRpcModule {
  // - moduleNames that start with @decentraland are from ECS6 and they should load the legacy ones.
  // - moduleNames that start with ~system, are the new ones that follow the protocol buffer generation
  //    (a single object as @param, and a single object as @returns)
  const moduleToLoad = moduleName.replace(/^@decentraland\//, 'Legacy').replace(/^~system\//, '')
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
