import { select, call } from 'redux-saga/effects'
import { RemoteStream } from 'ion-sdk-js'

import { AddRemoteStream, RemoveRemoteStream, REMOVE_REMOTE_STREAM } from '../actions'
import { getRemoteStreams } from '../selectors'
import { addVoiceStream, removeVoiceStream } from '../'

export function* voiceStream(action: AddRemoteStream | RemoveRemoteStream) {
  if (action.type === REMOVE_REMOTE_STREAM) {
    yield call(() => removeVoiceStream(action.payload.streamId))
    return
  }

  const remoteStreams: RemoteStream[] = yield select(getRemoteStreams)
  yield call(() => addVoiceStream(remoteStreams))
}
