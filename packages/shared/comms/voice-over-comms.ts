import { Package, VoiceFragment } from './interface/types'
import { positionReportToCommsPosition } from './interface/utils'
import { store } from 'shared/store/isolatedStore'
import { getCommsContext, getVoiceChat } from './selectors'
import { createLogger } from 'shared/logger'
import { setVoiceChat, voicePlayingUpdate, voiceRecordingUpdate } from './actions'
import { put, select } from 'redux-saga/effects'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { createVoiceChat, VoiceChat } from 'voice-chat-codec/VoiceChat'
import { positionObservable, PositionReport } from 'shared/world/positionThings'
import { shouldPlayVoice } from './voice-selectors'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { setupPeer } from './peers'

const logger = createLogger('VoiceCommunicator: ')

export function processVoiceFragment(message: Package<VoiceFragment>) {
  const state = store.getState()
  const voiceChat = getVoiceChat(state)
  const profile = getCurrentUserProfile(state)

  const peerTrackingInfo = setupPeer(message.sender)

  if (
    profile &&
    peerTrackingInfo.ethereumAddress &&
    peerTrackingInfo.position &&
    shouldPlayVoice(state, profile, peerTrackingInfo.ethereumAddress) &&
    voiceChat.playEncodedAudio
  ) {
    voiceChat
      .playEncodedAudio(peerTrackingInfo.ethereumAddress, peerTrackingInfo.position, message.data)
      .catch((e) => logger.error('Error playing encoded audio!', e))
  }
}

export function* initializeVoiceChat() {
  logger.info('Initializing VoiceCommunicator')
  /*const voiceCommunicator = new VoiceCommunicator(
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

  voiceCommunicator.addStreamRecordingErrorListener(function (message) {
    getUnityInstance().ShowNotification({
      type: NotificationType.GENERIC,
      message,
      buttonMessage: 'OK',
      timer: 5
    })
    trackEvent('error', {
      context: 'voice-chat',
      message: 'stream recording error: ' + message,
      stack: 'addStreamRecordingErrorListener'
    })
    store.dispatch(leaveVoiceChat())
  })
  ;(globalThis as any).__DEBUG_VOICE_COMMUNICATOR = voiceCommunicator
  */
  const voiceChat = createVoiceChat()

  const commsContext = getCommsContext(store.getState())
  if (commsContext) {
    voiceChat.setTransport(commsContext.worldInstanceConnection)
  }

  positionObservable.add((obj: Readonly<PositionReport>) => {
    voiceChat.reportPosition(positionReportToCommsPosition(obj))
  })

  voiceChat.onUserTalking((userId: string, talking: boolean) => {
    store.dispatch(voicePlayingUpdate(userId, talking))
  })

  voiceChat.onRecording((recording: boolean) => {
    store.dispatch(voiceRecordingUpdate(recording))
  })

  yield put(setVoiceChat(voiceChat))
  getUnityInstance().SetVoiceChatStatus({ isConnected: true })
}

export function* destroyVoiceChat() {
  getUnityInstance().SetVoiceChatStatus({ isConnected: false })
  const voiceChat: VoiceChat = yield select(getVoiceChat)
  voiceChat.setTransport(null)
  //;(globalThis as any).__DEBUG_VOICE_COMMUNICATOR = null
  logger.info('Leave Voice Chat')
}
