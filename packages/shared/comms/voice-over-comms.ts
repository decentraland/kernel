import { Package, VoiceFragment } from './interface/types'
import { Position, rotateUsingQuaternion } from './interface/utils'
import { store } from 'shared/store/isolatedStore'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { VoiceCommunicator, VoiceSpatialParams } from 'voice-chat-codec/VoiceCommunicator'
import { voicePlayingUpdate, voiceRecordingUpdate } from './actions'
import { isVoiceChatRecording, shouldPlayVoice } from './selectors'
import { EncodedFrame } from 'voice-chat-codec/types'
import Html from 'shared/Html'
import { CommsContext, commsLogger } from './context'
import { createLogger } from 'shared/logger'
import { commConfigurations } from 'config'
import { getCommsContext } from 'shared/protocol/selectors'

export let voiceCommunicator: VoiceCommunicator | null = null

const logger = createLogger('VoiceCommunicator: ')

export function processVoiceFragment(context: CommsContext, message: Package<VoiceFragment>) {
  const profile = getCurrentUserProfile(store.getState())

  const peerTrackingInfo = context.ensurePeerTrackingInfo(message.sender)

  if (peerTrackingInfo) {
    if (
      profile &&
      peerTrackingInfo.identity &&
      peerTrackingInfo.position &&
      shouldPlayVoice(profile, peerTrackingInfo.identity)
    ) {
      voiceCommunicator
        ?.playEncodedAudio(peerTrackingInfo.identity, getSpatialParamsFor(peerTrackingInfo.position), message.data)
        .catch((e) => logger.error('Error playing encoded audio!', e))
    }
  }
}

export function setListenerSpatialParams(context: CommsContext) {
  if (context.currentPosition) {
    voiceCommunicator?.setListenerSpatialParams(getSpatialParamsFor(context.currentPosition))
  }
}

export function initVoiceCommunicator(userId: string) {
  if (!voiceCommunicator) {
    commsLogger.info('Initializing VoiceCommunicator with userId ' + userId)
    voiceCommunicator = new VoiceCommunicator(
      userId,
      {
        send(frame: EncodedFrame) {
          const commsContext = getCommsContext(store.getState())

          if (commsContext && commsContext.currentPosition && commsContext.worldInstanceConnection) {
            commsContext.worldInstanceConnection
              .sendVoiceMessage(commsContext.currentPosition, frame)
              .catch(commsLogger.error)
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
  }
}

export function getSpatialParamsFor(position: Position): VoiceSpatialParams {
  return {
    position: position.slice(0, 3) as [number, number, number],
    orientation: rotateUsingQuaternion(position, 0, 0, -1)
  }
}

export async function setVoiceCommunicatorInputStream(a: MediaStream) {
  await voiceCommunicator!.setInputStream(a)
  if (isVoiceChatRecording(store.getState())) {
    voiceCommunicator!.start()
  } else {
    voiceCommunicator!.pause()
  }
}
