import { Package, VoiceFragment } from './interface/types'
import { Position, positionReportToCommsPosition, rotateUsingQuaternion } from './interface/utils'
import { store } from 'shared/store/isolatedStore'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { VoiceCommunicator, VoiceSpatialParams } from 'voice-chat-codec/VoiceCommunicator'
import { getCommsContext, getVoiceCommunicator } from './selectors'
import { createLogger } from 'shared/logger'
import { commConfigurations } from 'config'
import Html from 'shared/Html'
import { EncodedFrame } from 'voice-chat-codec/types'
import { setVoiceCommunicator, voicePlayingUpdate, voiceRecordingUpdate } from './actions'
import { put } from 'redux-saga/effects'
import { setupPeer } from './peers'
import { shouldPlayVoice } from './voice-selectors'
import { positionObservable, PositionReport } from 'shared/world/positionThings'

const logger = createLogger('VoiceCommunicator: ')

export function processVoiceFragment(message: Package<VoiceFragment>) {
  const state = store.getState()
  const voiceCommunicator = getVoiceCommunicator(state)
  const profile = getCurrentUserProfile(state)

  const peerTrackingInfo = setupPeer(message.sender)

  if (
    profile &&
    peerTrackingInfo.ethereumAddress &&
    peerTrackingInfo.position &&
    shouldPlayVoice(state, profile, peerTrackingInfo.ethereumAddress)
  ) {
    voiceCommunicator
      .playEncodedAudio(peerTrackingInfo.ethereumAddress, getSpatialParamsFor(peerTrackingInfo.position), message.data)
      .catch((e) => logger.error('Error playing encoded audio!', e))
  }
}

function setListenerSpatialParams(position: Position) {
  const state = store.getState()
  getVoiceCommunicator(state).setListenerSpatialParams(getSpatialParamsFor(position))
}

export function getSpatialParamsFor(position: Position): VoiceSpatialParams {
  return {
    position: position.slice(0, 3) as [number, number, number],
    orientation: rotateUsingQuaternion(position, 0, 0, -1)
  }
}

export function* initVoiceCommunicator() {
  logger.info('Initializing VoiceCommunicator')
  const voiceCommunicator = new VoiceCommunicator(
    {
      send(frame: EncodedFrame) {
        const commsContext = getCommsContext(store.getState())

        if (commsContext && commsContext.currentPosition) {
          commsContext.worldInstanceConnection.sendVoiceMessage(commsContext.currentPosition, frame).catch(logger.error)
        }
      }
    },
    {
      initialListenerParams: undefined,
      panningModel: commConfigurations.voiceChatUseHRTF ? 'HRTF' : 'equalpower',
      loopbackAudioElement: Html.loopbackAudioElement()
    }
  )

  voiceCommunicator.addStreamPlayingListener((userId, playing) => {
    store.dispatch(voicePlayingUpdate(userId, playing))
  })

  voiceCommunicator.addStreamRecordingListener((recording) => {
    store.dispatch(voiceRecordingUpdate(recording))
  })

  positionObservable.add((obj: Readonly<PositionReport>) => {
    setListenerSpatialParams(positionReportToCommsPosition(obj))
  })
  ;(globalThis as any).__DEBUG_VOICE_COMMUNICATOR = voiceCommunicator

  yield put(setVoiceCommunicator(voiceCommunicator))
}
