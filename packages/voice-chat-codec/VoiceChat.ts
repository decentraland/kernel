import { RoomConnection } from 'shared/comms/interface/index'
import * as liveKit from 'livekit-client'
import { VoiceCommunicator } from './opus/VoiceCommunicator'

interface VoiceChat {
  // Connection Methods
  // connects or disconnects a room
  setRoom(room: liveKit.Room | null): void
  // connects or disconnects a transport for legacy voiceChat
  setTransport(transport: RoomConnection): void

  // UI Methods
  // setTalking is called from the UI or keyboard to broadcast audio
  setRecording(recording: boolean): void
  // used to know if a user is talking or not, for the UI
  onUserTalking(cb: (userId: string, talking: boolean) => void): void
}

class VoiceChatImpl implements VoiceChat {
  voiceChatImpl: VoiceCommunicator | undefined

  setRoom(room: liveKit.Room | null): void {
    throw new Error('Method not implemented.')
  }
  setTransport(transport: RoomConnection): void {
    throw new Error('Method not implemented.')
  }
  setRecording(recording: boolean): void {
    throw new Error('Method not implemented.')
  }
  onUserTalking(cb: (userId: string, talking: boolean) => void): void {
    throw new Error('Method not implemented.')
  }
}
