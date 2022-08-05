import { CommsEvents, RoomConnection } from '../comms/interface/index'
import mitt from 'mitt'

export class OfflineRoomConnection implements RoomConnection {
  events = mitt<CommsEvents>()

  constructor() {}
  async connect(): Promise<void> {}
  async sendPositionMessage() {}
  async sendParcelUpdateMessage() {}
  async sendProfileMessage() {}
  async sendProfileRequest() {}
  async sendProfileResponse() {}
  async sendInitialMessage() {}
  async sendParcelSceneCommsMessage() {}
  async sendChatMessage() {}
  sendTopicMessage() {}
  sendTopicIdentityMessage() {}
  async setTopics() {}
  async disconnect() {}
  async sendVoiceMessage() {}
}
