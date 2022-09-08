import { createLogger } from 'shared/logger'
import { VoiceHandler } from './VoiceHandler'
import { EncodedFrame } from './types'
import { VoiceCommunicator } from './VoiceCommunicator'
import { commConfigurations } from 'config'
import Html from 'shared/Html'
import { RoomConnection } from 'shared/comms/interface'
import { Position } from 'shared/comms/interface/utils'
import { getSpatialParamsFor } from './utils'

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

  logger.log('initialized')

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
    onError(cb) {
      voiceCommunicator.addStreamRecordingErrorListener((message) => {
        cb(message)
      })
    },
    reportPosition(position: Position) {
      currentPosition = position
      voiceCommunicator.setListenerSpatialParams(getSpatialParamsFor(position))
    },
    setVolume: function (volume) {
      voiceCommunicator.setVolume(volume)
    },
    setMute: (mute) => {
      voiceCommunicator.setMute(mute)
    },
    setInputStream: (stream) => {
      return voiceCommunicator.setInputStream(stream)
    },
    hasInput: () => {
      return voiceCommunicator.hasInput()
    },
    playEncodedAudio: (src, position, encoded) => {
      return voiceCommunicator.playEncodedAudio(src, getSpatialParamsFor(position), encoded)
    }
  }
}
