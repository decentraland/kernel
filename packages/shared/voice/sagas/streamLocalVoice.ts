import { select, call, put } from 'redux-saga/effects'
import { Client, LocalStream, Constraints } from 'ion-sdk-js'

import { setLocalStream } from '../actions'
import { getClient } from '../selectors'

export function* streamLocalVoice() {
  const client: Client = yield select(getClient)
  const options: Constraints = {
    resolution: 'hd',
    audio: true,
    codec: 'vp8',
    video: false,
    simulcast: true,
    sendEmptyOnMute: true
  }
  const localStream: LocalStream = yield call(LocalStream.getUserMedia, options)
  yield call(() => client.publish(localStream))
  yield put(setLocalStream(localStream))
}
