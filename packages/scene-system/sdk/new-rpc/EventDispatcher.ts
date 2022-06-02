import { LoadedModules } from 'shared/apis/client'
import { numberToIdStore } from '../Utils'
import { addStat } from './Stats'

export type EventState = { allowOpenExternalUrl: boolean }
export type EventCallback = (event: { type: string; data: any }) => void

export async function createEventDispatcher(
  EngineAPI: LoadedModules['EngineAPI'],
  eventArgs: { eventState: EventState; onEventFunctions: EventCallback[] }
) {
  for await (const notif of EngineAPI!.streamEvents({})) {
    addStat('eventReceive', 1, notif.eventData.length)

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
