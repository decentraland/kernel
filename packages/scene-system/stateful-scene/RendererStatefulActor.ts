import { CLASS_ID } from '@dcl/legacy-ecs'
import {
  AttachEntityComponentPayload,
  ComponentCreatedPayload,
  ComponentRemovedPayload,
  ComponentUpdatedPayload,
  CreateEntityPayload,
  EntityAction,
  RemoveEntityPayload,
  UpdateEntityComponentPayload
} from 'shared/types'
import {
  Component,
  ComponentData,
  ComponentId,
  EntityId,
  StateContainer,
  StateContainerListener,
  StatefulActor
} from './types'
import { generatePBObjectJSON } from '../sdk/Utils'
import { LoadedModules } from 'shared/apis/client'
import defaultLogger from 'shared/logger'
import { EventCallback } from 'scene-system/sdk/new-rpc/EventDispatcher'

export class RendererStatefulActor extends StatefulActor implements StateContainerListener {
  private disposableComponents: number = 0

  constructor(
    protected readonly modules: LoadedModules,
    private readonly sceneId: string,
    private readonly eventCallbacks: { onEventFunctions: EventCallback[] }
  ) {
    super()
  }

  sendBatch(events: EntityAction[]) {
    this.modules
      .EngineAPI!.sendBatch({
        actions: events.map((item) => ({
          type: item.type,
          tag: item.tag,
          payload: JSON.stringify(item.payload)
        }))
      })
      .catch((err) => defaultLogger.error(err))
  }

  addEntity(entityId: EntityId, components?: Component[]): void {
    const batch: EntityAction[] = [
      {
        type: 'CreateEntity',
        payload: { id: entityId } as CreateEntityPayload
      }
    ]
    if (components) {
      components
        .map(({ componentId, data }) => this.mapComponentToActions(entityId, componentId, data))
        .forEach((actions) => batch.push(...actions))
    }
    this.sendBatch(batch)
  }

  removeEntity(entityId: EntityId): void {
    this.sendBatch([
      {
        type: 'RemoveEntity',
        payload: { id: entityId } as RemoveEntityPayload
      }
    ])
  }

  setComponent(entityId: EntityId, componentId: ComponentId, data: ComponentData): void {
    const updates = this.mapComponentToActions(entityId, componentId, data)
    this.sendBatch(updates)
  }

  removeComponent(entityId: EntityId, componentId: ComponentId): void {
    const { name } = this.getInfoAboutComponent(componentId)
    this.sendBatch([
      {
        type: 'ComponentRemoved',
        tag: entityId,
        payload: {
          entityId,
          name
        } as ComponentRemovedPayload
      }
    ])
  }

  sendInitFinished() {
    this.sendBatch([
      {
        type: 'InitMessagesFinished',
        tag: 'scene',
        payload: '{}'
      }
    ])
  }

  /**
   * Take a @param container and update it when an change to the º occurs
   */
  forwardChangesTo(container: StateContainer) {
    this.onAddEntity((entityId, components) => container.addEntity(entityId, components))
    this.onRemoveEntity((entityId) => container.removeEntity(entityId))
    this.onSetComponent((entityId, componentId, data) => container.setComponent(entityId, componentId, data))
    this.onRemoveComponent((entityId, componentId) => container.removeComponent(entityId, componentId))
  }

  onAddEntity(listener: (entityId: EntityId, components?: Component[]) => void): void {
    this.eventCallbacks.onEventFunctions.push((event) => {
      if (event.type === 'stateEvent') {
        const { type, payload } = event.data
        if (type === 'AddEntity') {
          listener(payload.entityId, payload.components)
        }
      }
    })
  }

  onRemoveEntity(listener: (entityId: EntityId) => void): void {
    this.eventCallbacks.onEventFunctions.push((event) => {
      if (event.type === 'stateEvent') {
        const { type, payload } = event.data
        if (type === 'RemoveEntity') {
          listener(payload.entityId)
        }
      }
    })
  }

  onSetComponent(listener: (entityId: EntityId, componentId: ComponentId, data: ComponentData) => void): void {
    this.eventCallbacks.onEventFunctions.push((event) => {
      if (event.type === 'stateEvent') {
        const { type, payload } = event.data
        if (type === 'SetComponent') {
          listener(payload.entityId, payload.componentId, payload.data)
        }
      }
    })
  }

  onRemoveComponent(listener: (entityId: EntityId, componentId: ComponentId) => void): void {
    this.eventCallbacks.onEventFunctions.push((event) => {
      if (event.type === 'stateEvent') {
        const { type, payload } = event.data
        if (type === 'RemoveComponent') {
          listener(payload.entityId, payload.componentId)
        }
      }
    })
  }

  private mapComponentToActions(entityId: EntityId, componentId: ComponentId, data: ComponentData): EntityAction[] {
    const { disposability } = this.getInfoAboutComponent(componentId)
    if (disposability === ComponentDisposability.DISPOSABLE) {
      return this.buildDisposableComponentActions(entityId, componentId, data)
    } else {
      return [
        {
          type: 'UpdateEntityComponent',
          tag: this.sceneId + '_' + entityId + '_' + componentId,
          payload: {
            entityId,
            classId: componentId,
            json: generatePBObjectJSON(componentId, data)
          } as UpdateEntityComponentPayload
        }
      ]
    }
  }

  private buildDisposableComponentActions(entityId: EntityId, classId: number, data: ComponentData): EntityAction[] {
    const id = `C${this.disposableComponents++}`
    return [
      {
        type: 'ComponentCreated',
        tag: id,
        payload: {
          id,
          classId
        } as ComponentCreatedPayload
      },
      {
        type: 'ComponentUpdated',
        tag: id,
        payload: {
          id,
          json: JSON.stringify(data)
        } as ComponentUpdatedPayload
      },
      {
        type: 'AttachEntityComponent',
        tag: entityId,
        payload: {
          entityId,
          id
        } as AttachEntityComponentPayload
      }
    ]
  }

  private getInfoAboutComponent(componentId: ComponentId): { name: string; disposability: ComponentDisposability } {
    switch (componentId) {
      case CLASS_ID.TRANSFORM:
        return { name: 'transform', disposability: ComponentDisposability.NON_DISPOSABLE }
      case CLASS_ID.NAME:
        return { name: 'name', disposability: ComponentDisposability.DISPOSABLE }
      case CLASS_ID.GLTF_SHAPE:
        return { name: 'shape', disposability: ComponentDisposability.DISPOSABLE }
      case CLASS_ID.NFT_SHAPE:
        return { name: 'shape', disposability: ComponentDisposability.DISPOSABLE }
      case CLASS_ID.LOCKED_ON_EDIT:
        return { name: 'lockedOnEdit', disposability: ComponentDisposability.DISPOSABLE }
      case CLASS_ID.VISIBLE_ON_EDIT:
        return { name: 'visibleOnEdit', disposability: ComponentDisposability.DISPOSABLE }
      case CLASS_ID.SMART_ITEM:
        return { name: 'script', disposability: ComponentDisposability.NON_DISPOSABLE }
    }
    throw new Error('Component not implemented yet')
  }
}

enum ComponentDisposability {
  DISPOSABLE,
  NON_DISPOSABLE
}
