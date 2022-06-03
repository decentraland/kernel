import { LoadedModules } from 'shared/apis/client'
import { numberToIdStore } from '../Utils'

export type EventState = { allowOpenExternalUrl: boolean }
export type EventCallback = (event: { type: string; data: any }) => void

export async function createEventDispatcher(
  EngineAPI: LoadedModules['EngineAPI'],
  eventArgs: { eventState: EventState; onEventFunctions: EventCallback[] }
) {
  for await (const notif of EngineAPI!.streamEvents({})) {
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

function isPointerEvent(event: any): boolean {
  switch (event.type) {
    case 'uuidEvent':
      return event.data?.payload?.buttonId !== undefined
  }
  return false
}

export type SimpleEventDispatcher = { onEventFunctions: EventCallback[] }

export async function createSimpleEventDispatcher(
  EngineAPI: LoadedModules['EngineAPI'],
  eventArgs: SimpleEventDispatcher
) {
  for await (const notif of EngineAPI!.streamEvents({})) {
    const data = JSON.parse(notif.eventData || '{}')
    const event = { type: notif.eventId, data }

    for (const cb of eventArgs.onEventFunctions) {
      try {
        cb(event)
      } catch (err) {
        console.error(err)
      }
    }
  }
}
