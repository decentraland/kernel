import { createLogger } from 'shared/logger'
import { VoiceHandler } from 'voice-chat-codec/VoiceChat'
import { EncodedFrame } from './types'
import { VoiceCommunicator, VoiceSpatialParams } from './VoiceCommunicator'
import { commConfigurations } from 'config'
import Html from 'shared/Html'
import { RoomConnection } from 'shared/comms/interface'
import { Position, rotateUsingQuaternion } from 'shared/comms/interface/utils'

function getSpatialParamsFor(position: Position): VoiceSpatialParams {
  return {
    position: position.slice(0, 3) as [number, number, number],
    orientation: rotateUsingQuaternion(position, 0, 0, -1)
  }
}

export const createOpusVoiceHandler = (transport: RoomConnection): VoiceHandler => {
  const logger = createLogger('OpusVoiceCommunicator: ')
  let currentPosition: Position | undefined

  const voiceCommunicator = new VoiceCommunicator(
    {
      send(frame: EncodedFrame) {
        if (currentPosition) {
          transport.sendVoiceMessage(currentPosition, frame).catch(logger.error)
        }
      }
    },
    {
      initialListenerParams: undefined,
      panningModel: commConfigurations.voiceChatUseHRTF ? 'HRTF' : 'equalpower',
      loopbackAudioElement: Html.loopbackAudioElement()
    }
  )

  return {
    setRecording(recording) {
      if (recording) {
        voiceCommunicator.start()
      } else {
        voiceCommunicator.pause()
      }
    },
    onUserTalking(cb) {
      voiceCommunicator.addStreamPlayingListener((streamId: string, playing: boolean) => {
        cb(streamId, playing)
      })
    },
    onRecording(cb) {
      voiceCommunicator.addStreamRecordingListener((recording: boolean) => {
        cb(recording)
      })
    },
    reportPosition(position: Position) {
      currentPosition = position
      voiceCommunicator.setListenerSpatialParams(getSpatialParamsFor(position))
    },
    setVolume: voiceCommunicator.setVolume,
    setMute: voiceCommunicator.setMute,
    setInputStream: voiceCommunicator.setInputStream,
    hasInput: voiceCommunicator.hasInput,
    playEncodedAudio: (src, position, encoded) => {
      return voiceCommunicator.playEncodedAudio(src, getSpatialParamsFor(position), encoded)
    }
  }
}
