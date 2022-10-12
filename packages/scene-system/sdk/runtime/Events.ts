import { EventData, EventDataType } from 'shared/protocol/decentraland/kernel/apis/engine_api.gen'

export type RuntimeEvent = { type: string; data: any }
export type RuntimeEventCallback = (event: RuntimeEvent) => void

export type SceneRuntimeEventState = { allowOpenExternalUrl: boolean }

export function EventDataToRuntimeEvent(e: EventData): RuntimeEvent {
  switch (e.type) {
    case EventDataType.EDT_GENERIC:
      return { type: e.generic?.eventId || '', data: JSON.parse(e.generic!.eventData || '{}') }
    case EventDataType.EDT_POSITION_CHANGED:
      return { type: 'positionChanged', data: e.positionChanged }
    case EventDataType.EDT_ROTATION_CHANGED:
      return { type: 'rotationChanged', data: e.rotationChanged }
  }

  return { type: '', data: '{}' }
}
