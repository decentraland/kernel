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
import { createLogger } from 'shared/logger'
import { VoiceHandler } from './VoiceHandler'
import { getAllPeers } from 'shared/comms/peers'
import { getSpatialParamsFor } from './utils'

//const AudioContext = (window as any).webkitAudioContext || window.AudioContext

const getPeerByAddress = (address: string) => {
  const peers = getAllPeers()
  for (const [_, peer] of peers) {
    if (peer.ethereumAddress === address) {
      return peer
    }
  }
  return undefined
}

type ParticipantInfo = {
  streamNode: MediaStreamAudioSourceNode
  panNode: PannerNode
  gainNode: GainNode
}

export const createLiveKitVoiceHandler = (room: Room): VoiceHandler => {
  const logger = createLogger('LiveKitVoiceCommunicator: ')

  const parentElement = Html.loopbackAudioElement()

  let recordingListener: ((state: boolean) => void) | undefined
  let errorListener: ((message: string) => void) | undefined
  let globalVolume: number = 1.0
  let globalMuted: boolean = false
  const validInput = true

  const participantsInfo = new Map<string, ParticipantInfo>()
  const audioContext = new AudioContext()
  const destination = audioContext.createMediaStreamDestination()
  if (parentElement) {
    parentElement.srcObject = destination.stream
  }

  function getGlobalVolume(): number {
    return globalMuted ? 0.0 : globalVolume
  }

  function addTrack(userId: string, track: RemoteTrack) {
    logger.log('track', track.mediaStream, track.kind)
    if (track.kind === Track.Kind.Audio) {
      // attach it to a new HTMLVideoElement or HTMLAudioElement
      //const element = track.attach()
      //parentElement?.appendChild(element)
      //track.attach()

      if (track.mediaStream) {
        const streamNode = audioContext.createMediaStreamSource(track.mediaStream)
        const options = {
          maxDistance: 10000,
          refDistance: 5,
          panningModel: 'equalpower',
          distanceModel: 'inverse'
        } as const

        const panNode = audioContext.createPanner()
        const gainNode = audioContext.createGain()
        //gainNode.gain.value = 0

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

        participantsInfo.set(userId, {
          panNode,
          gainNode,
          streamNode
        })
        logger.log('addTrack! ', userId)
      }
    }
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
    addTrack(participant.identity, track)
  }

  function handleTrackUnsubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    // remove tracks from all attached elements
    //track.detach()
    const userId = participant.identity
    const participantInfo = participantsInfo.get(userId)
    if (participantInfo) {
      disconnectParticipantInfo(participantInfo)
      participantsInfo.delete(userId)
    }
  }

  function handleDisconnect() {
    logger.log('Disconnected!')
    for (const [_, participantInfo] of participantsInfo) {
      disconnectParticipantInfo(participantInfo)
    }
    participantsInfo.clear()
  }

  function handleMediaDevicesError() {
    if (errorListener) errorListener('Media Device Error')
  }

  // add existing tracks
  for (const [_, participant] of room.participants) {
    for (const [_, trackPublication] of participant.audioTracks) {
      const track = trackPublication.track
      if (track) {
        addTrack(participant.identity, track)
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

      /*listener.positionX.value = spatialParams.position[0]
      listener.positionY.value = spatialParams.position[1]
      listener.positionZ.value = spatialParams.position[2]
      listener.forwardX.value = spatialParams.orientation[0]
      listener.forwardY.value = spatialParams.orientation[1]
      listener.forwardZ.value = spatialParams.orientation[2]
      listener.upX.value = 0
      listener.upY.value = 1
      listener.upZ.value = 0*/

      for (const [_, participant] of room.participants) {
        const userId = participant.identity
        const peer = getPeerByAddress(userId)
        const participantInfo = participantsInfo.get(userId)
        logger.log('update peer pos', userId, participantInfo, peer)
        if (peer && peer.position && participantInfo) {
          const panNode = participantInfo.panNode
          const spatialParams = getSpatialParamsFor(peer.position)
          panNode.positionX.value = spatialParams.position[0]
          panNode.positionY.value = spatialParams.position[1]
          panNode.positionZ.value = spatialParams.position[2]
          panNode.orientationX.value = spatialParams.orientation[0]
          panNode.orientationY.value = spatialParams.orientation[1]
          panNode.orientationZ.value = spatialParams.orientation[2]
          /*const distance = squareDistance(peer.position, position)
          const volMod = 1.0 - Math.log10(Math.min(distance, 5000.0)) / 5000.0
          //peerVolumeMod.set(userId, volMod)
          participant.setVolume(getGlobalVolume() * volMod)*/
        }
      }
    },
    setVolume: function (volume) {
      globalVolume = volume
      for (const [_, participant] of room.participants) {
        //const userId = participant.identity
        //const volMod = peerVolumeMod.get(userId) ?? 1.0
        participant.setVolume(getGlobalVolume() /** volMod*/)
      }
    },
    setMute: (mute) => {
      globalMuted = mute
    },
    setInputStream: async (localStream) => {
      /*try {
        await room.switchActiveDevice('audioinput', localStream.id)
        validInput = true
      } catch (e) {
        validInput = false
        if (errorListener) errorListener('setInputStream catch' + JSON.stringify(e))
      }*/
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
      /*if (parentElement) {
        while (parentElement.firstChild) {
          parentElement.removeChild(parentElement.firstChild)
        }
      }*/
    }
  }
}
