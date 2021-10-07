import { takeEvery } from 'redux-saga/effects'

import { WORLD_EXPLORER } from 'config'

import { SET_COMMS_ISLAND } from '../../comms/actions'
import { USER_AUTHENTIFIED } from '../../session/actions'
import { ADD_REMOTE_STREAM, RECONNECT_VOICE, REMOVE_REMOTE_STREAM, START_LOCAL_STREAM } from '../actions'
import { joinRoom } from './joinRoom'
import { initializeVoiceSaga } from './signalConnection'
import { streamLocalVoice } from './streamLocalVoice'
import { reconnectVoice } from './reconnectVoice'
import { voiceStream } from './voice-stream'

export function* voiceSaga() {
  // preview or builder mode
  if (WORLD_EXPLORER) {
    // User authenticates => initalize sfu webscoket => call joinRoom to join default island.
    // If fails, call reconnect voice.
    yield takeEvery(USER_AUTHENTIFIED, initializeVoiceSaga)

    // Island change => Leave current room and join the island room
    yield takeEvery(SET_COMMS_ISLAND, joinRoom)

    // Publish client stream
    yield takeEvery(START_LOCAL_STREAM, streamLocalVoice)

    // Reconnect voice signal
    yield takeEvery(RECONNECT_VOICE, reconnectVoice)

    // Start/Stop streams
    yield takeEvery(ADD_REMOTE_STREAM, voiceStream)
    yield takeEvery(REMOVE_REMOTE_STREAM, voiceStream)
  }
}
