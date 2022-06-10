import { select, take } from 'redux-saga/effects'

import { isRendererInitialized, isRendererReady } from './selectors'
import { RENDERER_INITIALIZED_CORRECTLY, RENDERER_READY } from './types'

export function* waitForRendererInstance() {
  while (!(yield select(isRendererInitialized))) {
    yield take(RENDERER_INITIALIZED_CORRECTLY)
  }
}

export function* waitForRendererReady() {
  while (!(yield select(isRendererReady))) {
    yield take(RENDERER_READY)
  }
}
