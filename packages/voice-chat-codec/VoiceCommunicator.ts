/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Participant,
  Track,
  LocalTrackPublication,
  LocalParticipant
} from 'livekit-client'

import defaultLogger from 'shared/logger'

export type VoiceCommunicator = {
  start: () => void
  pause: () => void
  subscribeOnRecordingStateChange: (callback: (state: boolean) => void) => void
}

export const createVoiceCommunicator = () => {
  // Temporal, token valid until 12 august 2022
  const qs = new URLSearchParams(location.search)
  const token = qs.get('token') as string

  const parentElement = new Audio()

  // creates a new room with options
  const room = new Room({
    // optimize publishing bandwidth and CPU for published tracks
    dynacast: true
  })

  const listenersRecordingChangeState: ((state: boolean) => void)[] = []

  function handleTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    if (track.kind === Track.Kind.Audio) {
      // attach it to a new HTMLVideoElement or HTMLAudioElement
      const element = track.attach()
      parentElement.appendChild(element)
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

  function handleLocalTrackUnpublished(track: LocalTrackPublication, participant: LocalParticipant) {
    // when local tracks are ended, update UI to remove them from rendering
    //track.detach()
  }

  room
    .connect('wss://test-livekit.decentraland.today', token)
    .then(() => {
      defaultLogger.log('[voice-chat] Connected!')
      room
        .on(RoomEvent.Disconnected, () => defaultLogger.log('[voice-chat] Disconnected!'))
        .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) =>
          defaultLogger.log('[voice-chat] participants=', speakers.length)
        )
        .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
        .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
        .on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished)
    })
    .catch((err) => defaultLogger.error('[voice-chat] room connect error: ', err))

  return {
    start: () => {
      listenersRecordingChangeState.every((callback) => callback(true))
      room.localParticipant
        .setMicrophoneEnabled(true)
        .then(() => {
          defaultLogger.log('[voice-chat] Start recording')
        })
        .catch((err) => defaultLogger.error('[voice-chat] Mic start error: ', err))
    },
    pause: () => {
      room.localParticipant
        .setMicrophoneEnabled(false)
        .then(() => {
          defaultLogger.log('[voice-chat] Stop recording')
          listenersRecordingChangeState.every((callback) => callback(false))
        })
        .catch((err) => defaultLogger.error('[voice-chat] Mic stop error: ', err))
    },
    subscribeOnRecordingStateChange: (callback: (state: boolean) => void) => {
      listenersRecordingChangeState.push(callback)
    }
  }
}
