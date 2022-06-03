import { LoadedModules, LoadableAPIs, LoadableNeedInit } from './../../../shared/apis/client'
import { componentNameRE, generatePBObject, getIdAsNumber } from './../Utils'
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
import { QueryType, Vector3 } from '@dcl/legacy-ecs'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import future, { IFuture } from 'fp-future'
import { EventCallback, EventState } from './EventDispatcher'
import { EntityAction } from 'shared/apis/gen/EngineAPI'

const WEB3_PROVIDER = 'web3-provider'
const PROVIDER_METHOD = 'getProvider'
const RESTRICTED_ACTION_MODULE = 'RestrictedActionModule'

export interface DecentralandInterfaceOptions {
  modules: LoadedModules
  onLog: (...args: any[]) => void
  onError: (e: Error) => void
  onEventFunctions: EventCallback[]
  sceneId: string
  clientPort: RpcClientPort
  eventState: EventState
  batchEvents: { events: EntityAction[] }
}

export function createDecentralandInterface(options: DecentralandInterfaceOptions) {
  const { batchEvents, modules, onError, onLog, sceneId, onEventFunctions, clientPort, eventState } = options

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
      modules.EngineAPI?.subscribe({ eventId: eventName }).catch((err: Error) => onError(err))
    },

    /** unsubscribe to specific event */
    unsubscribe(eventName: string): void {
      modules.EngineAPI?.unsubscribe({ eventId: eventName }).catch((err: Error) => onError(err))
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
      const loadingModule: IFuture<void> = future()
      loadingModules[_moduleName] = loadingModule
      try {
        const moduleToLoad = _moduleName.replace(/^@decentraland\//, '')
        let methods: string[] = []

        if (moduleToLoad === WEB3_PROVIDER) {
          methods.push(PROVIDER_METHOD)
          provider = await getEthereumProvider(modules, clientPort)
        } else if (moduleToLoad === RESTRICTED_ACTION_MODULE) {
          if (modules.RestrictedActions === undefined) {
            modules.RestrictedActions = await LoadableAPIs.RestrictedActions(clientPort)
          }
          ;(modules as any)[moduleToLoad] = {
            movePlayerTo(newPosition: Vector3, cameraTarget?: Vector3): Promise<void> {
              return modules.RestrictedActions!.movePlayerTo(newPosition, cameraTarget)
            }
          }
          methods.push('movePlayerTo')
        } else {
          try {
            if (moduleToLoad in LoadableAPIs) {
              ;(modules as any)[moduleToLoad] = await (LoadableAPIs as any)[moduleToLoad](clientPort)

              // todo: this is a hack :/
              if (LoadableNeedInit.includes(moduleToLoad)) {
                await (modules as any)[moduleToLoad].init({})
              }

              methods = Object.keys((modules as any)[moduleToLoad])
            } else {
              throw new Error('The module is not available in the list!')
            }
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
    loadingModules
  }
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
