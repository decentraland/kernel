import { EventData, EventDataType } from 'shared/protocol/kernel/apis/EngineAPI.gen'

export type RuntimeEvent = { type: string; data: any }
export type RuntimeEventCallback = (event: RuntimeEvent) => void

export type SceneRuntimeEventState = { allowOpenExternalUrl: boolean }

export function EventDataToRuntimeEvent(e: EventData): RuntimeEvent {
  switch (e.type) {
    case EventDataType.Generic:
      return { type: e.generic?.eventId || '', data: JSON.parse(e.generic!.eventData || '{}') }
    case EventDataType.PositionChanged:
      return { type: 'positionChanged', data: e.positionChanged }
    case EventDataType.RotationChanged:
      return { type: 'rotationChanged', data: e.rotationChanged }
  }

  return { type: '', data: '{}' }
}
