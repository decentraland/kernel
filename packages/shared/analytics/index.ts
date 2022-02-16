import { DEBUG_ANALYTICS } from 'config'
import { defaultLogger } from 'shared/logger'
import { globalObservable } from '../observables'

export type SegmentEvent = {
  name: string
  data: string
}

export function trackEvent(eventName: string, eventData: Record<string, any>) {
  if (DEBUG_ANALYTICS) {
    defaultLogger.info(`Tracking event "${eventName}": `, eventData)
  }

  globalObservable.emit('trackingEvent', {
    eventName,
    eventData
  })
}
