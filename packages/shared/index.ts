import './apis/index'
import './events'

import { notStarted } from './loading/types'
import { buildStore } from './store/store'
import { initializeUrlPositionObserver } from './world/positionThings'
import { initializeUrlIslandObserver } from './comms'
import { initializeUrlRealmObserver } from './dao'
import { globalObservable } from './observables'
import { isRendererVisible } from './loading/selectors'
import { RootStore } from './store/rootTypes'
import { initializeSessionObserver } from './session/sagas'
import { hookAnalyticsObservables } from './analytics'
import defaultLogger from './logger'

declare const globalThis: { globalStore: RootStore }

export function initShared() {
  if (globalThis.globalStore) {
    return
  }

  const { store, startSagas } = buildStore()
  globalThis.globalStore = store

  startSagas()

  store.dispatch(notStarted())

  initializeUrlPositionObserver()
  initializeUrlRealmObserver()
  initializeUrlIslandObserver()
  initializeRendererVisibleObserver(store)
  initializeSessionObserver()
  hookAnalyticsObservables()
}

function observeIsRendererVisibleChanges(store: RootStore, cb: (visible: boolean) => void) {
  let prevValue = isRendererVisible(store.getState())

  cb(prevValue)

  store.subscribe(() => {
    const newValue = isRendererVisible(store.getState())

    if (newValue !== prevValue) {
      prevValue = newValue
      cb(newValue)
    }
  })
}

export function initializeRendererVisibleObserver(store: RootStore) {
  observeIsRendererVisibleChanges(store, (visible: boolean) => {
    defaultLogger.log('renderer visible', visible)
    globalObservable.emit('rendererVisible', {
      visible
    })
  })
}
