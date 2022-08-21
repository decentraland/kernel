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
import { Position, squareDistance } from 'shared/comms/interface/utils'

import Html from 'shared/Html'
import { createLogger } from 'shared/logger'
import { VoiceHandler } from './VoiceHandler'
import { setupPeer } from 'shared/comms/peers'

export const createLiveKitVoiceHandler = (room: Room): VoiceHandler => {
  const logger = createLogger('LiveKitVoiceCommunicator: ')

  const parentElement = Html.loopbackAudioElement()

  let recordingListener: ((state: boolean) => void) | undefined
  let errorListener: ((message: string) => void) | undefined
  let globalVolume: number = 1.0
  let globalMuted: boolean = false
  let validInput = true
  const peerVolumeMod = new Map<string, number>()

  function getGlobalVolume(): number {
    return globalMuted ? 0.0 : globalVolume
  }

  function addTrack(track: RemoteTrack) {
    if (track.kind === Track.Kind.Audio) {
      // attach it to a new HTMLVideoElement or HTMLAudioElement
      const element = track.attach()
      parentElement?.appendChild(element)
    }
  }

  function handleTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    addTrack(track)
  }

  function handleTrackUnsubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    // remove tracks from all attached elements
    track.detach()
  }

  function handleDisconnect() {
    logger.log('[voice-chat] Disconnected!')
  }

  function handleMediaDevicesError() {
    if (errorListener) errorListener('Media Device Error')
  }

  // add existing tracks
  for (const [_, participant] of room.participants) {
    for (const [_, trackPublication] of participant.audioTracks) {
      const track = trackPublication.track
      if (track) {
        addTrack(track)
      }
    }
  }

  room
    .on(RoomEvent.Disconnected, handleDisconnect)
    .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
    .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
    .on(RoomEvent.MediaDevicesError, handleMediaDevicesError)

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
        for (const [_, participant] of room.participants) {
          cb(participant.identity, participant.isSpeaking)
        }
      })
    },
    onRecording(cb) {
      recordingListener = cb
    },
    onError(cb) {
      errorListener = cb
    },
    reportPosition(position: Position) {
      for (const [_, participant] of room.participants) {
        const userId = participant.identity
        const peer = setupPeer(userId)
        if (peer && peer.position) {
          const distance = squareDistance(peer.position, position)
          const volMod = 1.0 - Math.min(distance, 5000.0) / 5000.0
          peerVolumeMod.set(userId, volMod)
          logger.log('distance:', distance, volMod)
          participant.setVolume(getGlobalVolume() * volMod)
        }
      }
    },
    setVolume: function (volume) {
      globalVolume = volume
      for (const [_, participant] of room.participants) {
        const userId = participant.identity
        const volMod = peerVolumeMod.get(userId) ?? 1.0
        participant.setVolume(getGlobalVolume() * volMod)
      }
    },
    setMute: (mute) => {
      globalMuted = mute
    },
    setInputStream: async (stream) => {
      try {
        await room.switchActiveDevice('audioinput', stream.id)
        validInput = true
      } catch (e) {
        validInput = false
        if (errorListener) errorListener('setInputStream catch' + JSON.stringify(e))
      }
    },
    hasInput: () => {
      return validInput
    },
    leave: () => {
      room
        .off(RoomEvent.Disconnected, handleDisconnect)
        .off(RoomEvent.TrackSubscribed, handleTrackSubscribed)
        .off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
        .off(RoomEvent.MediaDevicesError, handleMediaDevicesError)

      // Remove all childs
      if (parentElement) {
        while (parentElement.firstChild) {
          parentElement.removeChild(parentElement.firstChild)
        }
      }
    }
  }
}
