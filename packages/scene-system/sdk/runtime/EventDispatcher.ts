import { LoadedModules } from 'shared/apis/client'
import { DevToolsAdapter } from './DevToolsAdapter'

export type SimpleEvent = { type: string; data: any }
export type EventState = { allowOpenExternalUrl: boolean }
export type EventCallback = (event: SimpleEvent) => void

export type EventDispatcherOptions = {
  EngineAPI: LoadedModules['EngineAPI']
  devToolsAdapter: DevToolsAdapter
  receiver: EventCallback
}

export function createEventDispatcher(options: EventDispatcherOptions) {
  const { EngineAPI, devToolsAdapter, receiver } = options

  async function run() {
    for await (const notif of EngineAPI!.streamEvents({})) {
      receiver({ type: notif.eventId, data: JSON.parse(notif.eventData || '{}') })
    }
  }

  return {
    start() {
      run().catch(devToolsAdapter.error)
    }
  }
}

export function isPointerEvent(event: SimpleEvent): boolean {
  switch (event.type) {
    case 'uuidEvent':
      return event.data?.payload?.buttonId !== undefined
  }
  return false
}
