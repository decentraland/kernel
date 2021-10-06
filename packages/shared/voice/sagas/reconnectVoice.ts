import { select, call, delay } from 'redux-saga/effects'

import { getReconnectTimes } from '../selectors'
import { initializeVoiceSaga } from './signalConnection'

const DEFAULT_TIMEOUT = 1000
const MAX_RETRY_ATTEMPS = 10

export function* reconnectVoice() {
  const reconnectTimes: number = yield select(getReconnectTimes)

  if (reconnectTimes > MAX_RETRY_ATTEMPS) {
    // Do something when we cannot reconnect to the socket
    return
  }
  yield delay(DEFAULT_TIMEOUT * reconnectTimes)
  yield call(initializeVoiceSaga)
}
