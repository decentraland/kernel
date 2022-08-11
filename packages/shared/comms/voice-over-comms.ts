import { store } from 'shared/store/isolatedStore'
import { VoiceCommunicator, createVoiceCommunicator } from 'voice-chat-codec/VoiceCommunicator'
import { createLogger } from 'shared/logger'
import { setVoiceCommunicator, voiceRecordingUpdate } from './actions'
import { put } from 'redux-saga/effects'

const logger = createLogger('VoiceCommunicator: ')

export function* initVoiceCommunicator() {
  logger.info('Initializing VoiceCommunicator')
  const voiceCommunicator: VoiceCommunicator = createVoiceCommunicator()

  voiceCommunicator.subscribeOnRecordingStateChange((recording: boolean) => {
    store.dispatch(voiceRecordingUpdate(recording))
  })
  /*positionObservable.add((obj: Readonly<PositionReport>) => {
    TODO: Implement spatial sounds
  })*/
  ;(globalThis as any).__DEBUG_VOICE_COMMUNICATOR = voiceCommunicator

  yield put(setVoiceCommunicator(voiceCommunicator))
}
