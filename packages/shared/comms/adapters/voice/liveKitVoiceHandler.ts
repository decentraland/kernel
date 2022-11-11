/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Track,
  ParticipantEvent
} from 'livekit-client'
import Html from 'shared/Html'
import { createLogger } from 'shared/logger'
import { VoiceHandler } from '../../../voiceChat/VoiceHandler'
import { getPeer } from 'shared/comms/peers'
import { getSpatialParamsFor, isChrome } from '../../../voiceChat/utils'
import { startLoopback } from './loopback'

import * as rfc4 from '@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen'

type ParticipantInfo = {
  streamNode: MediaStreamAudioSourceNode
  panNode: PannerNode
  gainNode: GainNode
}

export const createLiveKitVoiceHandler = async (room: Room): Promise<VoiceHandler> => {
  const logger = createLogger('LiveKitVoiceCommunicator: ')

  const parentElement = Html.loopbackAudioElement()

  let recordingListener: ((state: boolean) => void) | undefined
  let errorListener: ((message: string) => void) | undefined
  let globalVolume: number = 1.0
  let globalMuted: boolean = false
  let validInput = false
  let onUserTalkingCallback: (userId: string, talking: boolean) => void = () => {}

  const participantsInfo = new Map<string, ParticipantInfo>()
  const audioContext = new AudioContext()
  const destination = audioContext.createMediaStreamDestination()
  const destinationStream = isChrome() ? await startLoopback(destination.stream) : destination.stream

  if (parentElement) {
    parentElement.srcObject = destinationStream
  }

  function getGlobalVolume(): number {
    return globalMuted ? 0.0 : globalVolume
  }

  function addTrack(participant: RemoteParticipant, track: RemoteTrack) {
    participant.on(ParticipantEvent.IsSpeakingChanged, (talking: boolean) => {
      onUserTalkingCallback(participant.identity, talking)
    })
    participant.on(ParticipantEvent.TrackPublished, (...args) => {
      logger.info('ParticipantEvent.TrackPublished', args)
    })
    participant.on(ParticipantEvent.LocalTrackPublished, (...args) => {
      logger.info('ParticipantEvent.LocalTrackPublished', args)
    })
    if (track.kind === Track.Kind.Audio) {
      if (track.mediaStream) {
        logger.log('Adding media track', track)
        const streamNode = audioContext.createMediaStreamSource(track.mediaStream)
        const options = {
          maxDistance: 10000,
          refDistance: 5,
          panningModel: 'equalpower',
          distanceModel: 'inverse'
        } as const

        const panNode = audioContext.createPanner()
        const gainNode = audioContext.createGain()

        streamNode.connect(panNode)
        panNode.connect(gainNode)
        gainNode.connect(destination)

        // configure pan node
        panNode.coneInnerAngle = 180
        panNode.coneOuterAngle = 360
        panNode.coneOuterGain = 0.91
        panNode.maxDistance = options.maxDistance ?? 10000
        panNode.refDistance = options.refDistance ?? 5
        panNode.panningModel = options.panningModel ?? 'equalpower'
        panNode.distanceModel = options.distanceModel ?? 'inverse'
        panNode.rolloffFactor = 1.0

        participantsInfo.set(participant.identity, {
          panNode,
          gainNode,
          streamNode
        })
      } else debugger
    } else debugger
  }

  function disconnectParticipantInfo(participantInfo: ParticipantInfo) {
    participantInfo.gainNode.disconnect()
    participantInfo.panNode.disconnect()
    participantInfo.streamNode.disconnect()
  }

  function handleTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    addTrack(participant, track)
  }

  function handleTrackUnsubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    removeParticipant(participant)
  }

  function handleDisconnect() {
    logger.log('Disconnected!')
    room
      .off(RoomEvent.Disconnected, handleDisconnect)
      .off(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      .off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
      .off(RoomEvent.MediaDevicesError, handleMediaDevicesError)
      .off(RoomEvent.ParticipantConnected, addParticipant)
      .off(RoomEvent.ParticipantDisconnected, removeParticipant)

    for (const [_, participantInfo] of participantsInfo) {
      disconnectParticipantInfo(participantInfo)
    }
    participantsInfo.clear()
  }

  function handleMediaDevicesError() {
    if (errorListener) errorListener('Media Device Error')
  }

  function addParticipant(participant: RemoteParticipant) {
    for (const [_, trackPublication] of participant.audioTracks) {
      const track = trackPublication.track
      if (track) {
        addTrack(participant, track)
      }
      console.log('publication', participant, _, trackPublication)
    }
  }

  function removeParticipant(participant: RemoteParticipant) {
    // remove tracks from all attached elements
    const userId = participant.identity
    const participantInfo = participantsInfo.get(userId)
    if (participantInfo) {
      try {
        disconnectParticipantInfo(participantInfo)
      } catch (err: any) {
        logger.error(err)
      }
      participantsInfo.delete(userId)
    }
  }

  // add existing tracks
  for (const [_, participant] of room.participants) {
    addParticipant(participant)
  }

  room
    .on(RoomEvent.Disconnected, handleDisconnect)
    .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
    .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
    .on(RoomEvent.MediaDevicesError, handleMediaDevicesError)
    .on(RoomEvent.TrackPublished, function (publication, remoteParticipant) {
      console.log('TrackPublished', publication, remoteParticipant)
      addParticipant(remoteParticipant)
    })
    .on(RoomEvent.ParticipantConnected, addParticipant)
    .on(RoomEvent.ParticipantDisconnected, removeParticipant)
    .on(RoomEvent.RoomMetadataChanged, function (...args) {
      console.log('RoomMetadataChanged', args)
    })
    .on(RoomEvent.LocalTrackPublished, function (...args) {
      console.log('LocalTrackPublished', args)
    })
    .on(RoomEvent.MediaDevicesChanged, function (...args) {
      console.log('MediaDevicesChanged', args)
    })
    .on(RoomEvent.ParticipantMetadataChanged, function (...args) {
      console.log('ParticipantMetadataChanged', args)
    })

  logger.log('initialized')

  return {
    setRecording(recording) {
      room.localParticipant
        .setMicrophoneEnabled(recording)
        .then(() => {
          if (recordingListener) recordingListener(recording)
        })
        .catch((err) => logger.error('Error: ', err, ', recording=', recording))
    },
    onUserTalking(cb) {
      onUserTalkingCallback = cb
      try {
        if (!room.canPlaybackAudio) {
          room.startAudio()
        }

        parentElement?.play().catch(logger.log)
      } catch (err: any) {
        logger.error(err)
      }
    },
    onRecording(cb) {
      recordingListener = cb
    },
    onError(cb) {
      errorListener = cb
    },
    reportPosition(position: rfc4.Position) {
      const spatialParams = getSpatialParamsFor(position)
      const listener = audioContext.listener
      listener.setPosition(spatialParams.position[0], spatialParams.position[1], spatialParams.position[2])
      listener.setOrientation(
        spatialParams.orientation[0],
        spatialParams.orientation[1],
        spatialParams.orientation[2],
        0,
        1,
        0
      )

      for (const [_, participant] of room.participants) {
        const address = participant.identity
        const peer = getPeer(address)
        const participantInfo = participantsInfo.get(address)
        if (peer && peer.position && participantInfo) {
          const panNode = participantInfo.panNode
          const spatialParams = getSpatialParamsFor(peer.position)
          panNode.positionX.value = spatialParams.position[0]
          panNode.positionY.value = spatialParams.position[1]
          panNode.positionZ.value = spatialParams.position[2]
          panNode.orientationX.value = spatialParams.orientation[0]
          panNode.orientationY.value = spatialParams.orientation[1]
          panNode.orientationZ.value = spatialParams.orientation[2]
        }
      }
    },
    setVolume: function (volume) {
      globalVolume = volume
      for (const [_, participant] of room.participants) {
        participant.setVolume(getGlobalVolume())
      }
    },
    setMute: (mute) => {
      globalMuted = mute
      for (const [_, participant] of room.participants) {
        participant.setVolume(getGlobalVolume())
      }
    },
    setInputStream: async (localStream) => {
      try {
        await room.switchActiveDevice('audioinput', localStream.id)
        validInput = true
      } catch (e) {
        validInput = false
        if (errorListener) errorListener('setInputStream catch' + JSON.stringify(e))
      }
    },
    hasInput: () => {
      return validInput
    },
    destroy: () => {
      handleDisconnect()
    },
    participantsInfo
  } as any
}
