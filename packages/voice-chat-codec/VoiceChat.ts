import { RoomConnection } from 'shared/comms/interface/index'
import * as liveKit from 'livekit-client'
import defaultLogger from 'shared/logger'
import { createOpusVoiceHandler } from './opusVoiceHandler'
import { Position } from 'shared/comms/interface/utils'
import { EncodedFrame } from './types'

export type VoiceHandler = {
  // UI Methods
  // setTalking is called from the UI or keyboard to broadcast audio
  setRecording(recording: boolean): void

  // used to know if a user is talking or not, for the UI
  onUserTalking(cb: (userId: string, talking: boolean) => void): void

  onRecording(cb: (recording: boolean) => void): void

  reportPosition(recording: Position): void

  setVolume(volume: number): void

  setMute(mute: boolean): void

  setInputStream(stream: MediaStream): Promise<void>

  hasInput(): boolean

  // Play audio when we recive it from comms (only for opus)
  playEncodedAudio?(src: string, relativePosition: Position, encoded: EncodedFrame): Promise<void>
}

export type VoiceChat = {
  // Connection Methods
  // connects or disconnects a room
  setRoom(room: liveKit.Room | null): void
  // connects or disconnects a transport for legacy voiceChat
  setTransport(transport: RoomConnection | null): void
} & VoiceHandler

export const createVoiceChat = (): VoiceChat => {
  let voiceHandler: VoiceHandler | undefined
  let currentPosition: Position | undefined
  let currentVolume: number = 1
  let currentMute: boolean = false
  let currentStream: MediaStream
  let onRecordingCB: ((recording: boolean) => void) | undefined
  let onUserTalkingCB: ((userId: string, talking: boolean) => void) | undefined

  // Connection Methods
  // connects or disconnects a room
  function setRoom(room: liveKit.Room | null): void {
    defaultLogger.log('setRoom NOT IMPLEMENTED')
  }

  // connects or disconnects a transport for legacy voiceChat
  function setTransport(transport: RoomConnection | null): void {
    defaultLogger.log('setTransport')
    if (transport) {
      voiceHandler = createOpusVoiceHandler(transport)
      if (currentPosition) voiceHandler.reportPosition(currentPosition)
      voiceHandler.setMute(currentMute)
      voiceHandler.setVolume(currentVolume)
      voiceHandler.setInputStream(currentStream).catch(() => defaultLogger.log('Stream set!'))
      if (onUserTalkingCB) voiceHandler.onUserTalking(onUserTalkingCB)
      if (onRecordingCB) voiceHandler.onRecording(onRecordingCB)
    } else {
      voiceHandler = undefined
    }
  }

  // UI Methods
  // setTalking is called from the UI or keyboard to broadcast audio
  function setRecording(recording: boolean): void {
    if (voiceHandler) voiceHandler.setRecording(recording)
  }
  // used to know if a user is talking or not, for the UI
  function onUserTalking(cb: (userId: string, talking: boolean) => void): void {
    onUserTalkingCB = cb
    if (voiceHandler) voiceHandler.onUserTalking(cb)
  }

  function onRecording(cb: (recording: boolean) => void) {
    onRecordingCB = cb
    if (voiceHandler) voiceHandler.onRecording(cb)
  }

  function setVolume(volume: number): void {
    currentVolume = volume
    if (voiceHandler) voiceHandler.setVolume(volume)
  }

  function setMute(mute: boolean): void {
    currentMute = mute
    if (voiceHandler) voiceHandler.setMute(mute)
  }

  function reportPosition(position: Position) {
    currentPosition = position
    if (voiceHandler) {
      voiceHandler.reportPosition(currentPosition)
    }
  }

  async function setInputStream(stream: MediaStream): Promise<void> {
    currentStream = stream
    if (voiceHandler) await voiceHandler.setInputStream(stream)
  }

  function hasInput(): boolean {
    return voiceHandler?.hasInput() ?? false
  }

  function playEncodedAudio(src: string, position: Position, encoded: EncodedFrame): Promise<void> {
    if (voiceHandler && voiceHandler.playEncodedAudio) {
      return voiceHandler.playEncodedAudio(src, position, encoded)
    } else {
      return Promise.reject('No voice handler')
    }
  }

  return {
    setRoom,
    setTransport,
    setRecording,
    onUserTalking,
    reportPosition,
    setVolume,
    setMute,
    setInputStream,
    hasInput,
    onRecording,
    playEncodedAudio
  }
}
