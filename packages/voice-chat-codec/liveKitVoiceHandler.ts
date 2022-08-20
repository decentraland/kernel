/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Participant,
  Track
} from 'livekit-client'
import { Position } from 'shared/comms/interface/utils'

import Html from 'shared/Html'
import defaultLogger, { createLogger } from 'shared/logger'
import { VoiceHandler } from './VoiceHandler'

export const createLiveKitVoiceHandler = (room: Room): VoiceHandler => {
  const logger = createLogger('LiveKitVoiceCommunicator: ')

  const parentElement = Html.loopbackAudioElement()

  let recordingListener: ((state: boolean) => void) | undefined
  //let errorListener: ((message: string) => void) | undefined

  function handleTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    if (track.kind === Track.Kind.Audio) {
      // attach it to a new HTMLVideoElement or HTMLAudioElement
      const element = track.attach()
      parentElement?.appendChild(element)
    }
  }

  function handleTrackUnsubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    // remove tracks from all attached elements
    track.detach()
  }

  room
    .on(RoomEvent.Disconnected, () => defaultLogger.log('[voice-chat] Disconnected!'))
    .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
    .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
    .on(RoomEvent.MediaDevicesError, () => {
      //if (errorListener) errorListener('Media Device Error')
    })

  logger.log('initialized')
  return {
    setRecording(recording) {
      room.localParticipant
        .setMicrophoneEnabled(recording)
        .then(() => {
          logger.log('Set recording', recording)
          if (recordingListener) recordingListener(recording)
        })
        .catch((err) => logger.error('Error: ', err, ', recording=', recording))
    },
    onUserTalking(cb) {
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        for (const [sid, participant] of room.participants) {
          cb(sid, participant.isSpeaking)
        }
      })
    },
    onRecording(cb) {
      recordingListener = cb
    },
    onError(cb) {
      //errorListener = cb
    },
    reportPosition(position: Position) {
      //currentPosition = position
      //defaultLogger.log('reportPosition')
    },
    setVolume: function (volume) {
      defaultLogger.log('setVolume', volume)
      for (const [_, participant] of room.participants) {
        participant.setVolume(volume)
      }
    },
    setMute: (mute) => {
      defaultLogger.log('setMute', mute)
    },
    setInputStream: (stream) => {
      return Promise.resolve()
    },
    hasInput: () => {
      return true
    }
  }
}
