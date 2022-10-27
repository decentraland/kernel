import { DEBUG_PREFIX } from 'config'
import { notStarted } from './loading/types'
import { buildStore } from './store/store'
import { globalObservable } from './observables'
import { isRendererVisible } from './loading/selectors'
import { RootStore } from './store/rootTypes'
import { initializeSessionObserver } from './session/sagas'
import { hookAnalyticsObservables } from './analytics/hook-observable'
import wrapConsoleLogger from './logger/wrap'
import { beforeUnloadAction } from './actions'

declare const globalThis: { globalStore: RootStore }

export function initShared() {
  wrapConsoleLogger(DEBUG_PREFIX || '')

  if (globalThis.globalStore) {
    return
  }

  const { store, startSagas } = buildStore()
  globalThis.globalStore = store

  startSagas()

  store.dispatch(notStarted())

  initializeRendererVisibleObserver(store)
  initializeSessionObserver()
  hookAnalyticsObservables()

  if (typeof (window as any) !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      store.dispatch(beforeUnloadAction())
    })
  }
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

function initializeRendererVisibleObserver(store: RootStore) {
  observeIsRendererVisibleChanges(store, (visible: boolean) => {
    globalObservable.emit('rendererVisible', {
      visible
    })
  })
}
