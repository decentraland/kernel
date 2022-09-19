import { CommsEvents, RoomConnection } from '../comms/interface/index'
import mitt from 'mitt'
import * as rfc4 from './comms-rfc-4.gen'

export class OfflineRoomConnection implements RoomConnection {
  events = mitt<CommsEvents>()

  constructor() {}
  async disconnect(): Promise<void> {}
  async sendProfileMessage(_profile: rfc4.AnnounceProfileVersion): Promise<void> {}
  async sendProfileRequest(_request: rfc4.ProfileRequest): Promise<void> {}
  async sendProfileResponse(_response: rfc4.ProfileResponse): Promise<void> {}
  async sendPositionMessage(_position: Omit<rfc4.Position, 'index'>): Promise<void> {}
  async sendParcelSceneMessage(_message: rfc4.Scene): Promise<void> {}
  async sendChatMessage(_message: rfc4.Chat): Promise<void> {}
  async sendVoiceMessage(_message: rfc4.Voice): Promise<void> {}
  async connect(): Promise<void> {}
}
