import { call, put, select, take } from 'redux-saga/effects'
import { waitingForRenderer } from 'shared/loading/types'
import { initializeEngine } from 'unity-interface/dcl'
import type { UnityGame } from '@dcl/unity-renderer/src/index'
import { InitializeRenderer } from './actions'
import { isRendererInitialized } from './selectors'
import { RENDERER_INITIALIZED_CORRECTLY, RENDERER_INITIALIZE } from './types'
import { trackEvent } from 'shared/analytics'

export function* rendererSaga() {
  const action: InitializeRenderer = yield take(RENDERER_INITIALIZE)
  yield call(initializeRenderer, action)
}

export function* waitForRendererInstance() {
  while (!(yield select(isRendererInitialized))) {
    yield take(RENDERER_INITIALIZED_CORRECTLY)
  }
}

let handlerFunction: (type: string, jsonEncodedMessage: string) => void = () => void 0

export function setMessageFromEngineHandler(fn: typeof handlerFunction) {
  handlerFunction = fn
}

function* initializeRenderer(action: InitializeRenderer) {
  const { delegate, container } = action.payload

  // will start loading
  yield put(waitingForRenderer())

  // start loading the renderer
  try {
    const renderer: UnityGame = yield delegate(container)

    let startTime = performance.now()

    trackEvent('renderer_initializing_start', {})

    // wire the kernel to the renderer, at some point, the `initializeEngine`
    // function _MUST_ send the `signalRendererInitializedCorrectly` action
    // to signal that the renderer successfuly loaded
    yield call(initializeEngine, renderer)

    // wait for renderer start
    yield take(RENDERER_INITIALIZED_CORRECTLY)

    trackEvent('renderer_initializing_end', {
      loading_time: performance.now() - startTime
    })
  } catch (e) {
    if (e instanceof Error) {
      throw e
    } else {
      throw new Error('Error initializing rendering')
    }
  }
}
