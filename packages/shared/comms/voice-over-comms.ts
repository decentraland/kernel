import { Package, VoiceFragment } from './interface/types'
import { Position, rotateUsingQuaternion } from './interface/utils'
import { store } from 'shared/store/isolatedStore'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { VoiceCommunicator, VoiceSpatialParams } from 'voice-chat-codec/VoiceCommunicator'
import { getCommsContext, getVoiceCommunicator, shouldPlayVoice } from './selectors'
import { CommsContext } from './context'
import { createLogger } from 'shared/logger'
import { commConfigurations } from 'config'
import Html from 'shared/Html'
import { EncodedFrame } from 'voice-chat-codec/types'
import { setVoiceCommunicator, voicePlayingUpdate, voiceRecordingUpdate } from './actions'
import { put } from 'redux-saga/effects'

const logger = createLogger('VoiceCommunicator: ')

export function processVoiceFragment(context: CommsContext, message: Package<VoiceFragment>) {
  const state = store.getState()
  const voiceCommunicator = getVoiceCommunicator(state)
  const profile = getCurrentUserProfile(state)

  const peerTrackingInfo = context.ensurePeerTrackingInfo(message.sender)

  if (
    profile &&
    peerTrackingInfo.identity &&
    peerTrackingInfo.position &&
    shouldPlayVoice(profile, peerTrackingInfo.identity)
  ) {
    voiceCommunicator
      .playEncodedAudio(peerTrackingInfo.identity, getSpatialParamsFor(peerTrackingInfo.position), message.data)
      .catch((e) => logger.error('Error playing encoded audio!', e))
  }
}

export function setListenerSpatialParams(context: CommsContext) {
  const state = store.getState()
  if (context.currentPosition) {
    getVoiceCommunicator(state).setListenerSpatialParams(getSpatialParamsFor(context.currentPosition))
  }
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

        if (commsContext && commsContext.currentPosition && commsContext.worldInstanceConnection) {
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
  ;(globalThis as any).__DEBUG_VOICE_COMMUNICATOR = voiceCommunicator

  yield put(setVoiceCommunicator(voiceCommunicator))
}
