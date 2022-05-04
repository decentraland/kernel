import { CommsEvents, RoomConnection } from '../interface/index'
import { Package } from '../interface/types'
import { Position, positionHash } from '../interface/utils'
import {
  Peer as IslandBasedPeer,
  PeerConfig,
  PacketCallback,
  PeerStatus,
  PeerMessageType,
  PeerMessageTypes
} from '@dcl/catalyst-peer'
import {
  ChatData,
  CommsMessage,
  ProfileData,
  SceneData,
  PositionData,
  VoiceData,
  ProfileRequestData,
  ProfileResponseData
} from './proto/comms_pb'
import { CommsStatus } from '../types'

import { ProfileType } from 'shared/profiles/types'
import { EncodedFrame } from 'voice-chat-codec/types'
import mitt from 'mitt'
import { Avatar } from '@dcl/schemas'
import { ensureAvatarCompatibilityFormat } from 'shared/profiles/transformations/profileToServerFormat'
import { validateAvatar } from 'shared/profiles/schemaValidation'
import { createLogger } from 'shared/logger'

type PeerType = IslandBasedPeer

const logger = createLogger('Lighthouse: ')

type MessageData =
  | ChatData
  | ProfileData
  | SceneData
  | PositionData
  | VoiceData
  | ProfileRequestData
  | ProfileResponseData

export type LighthouseConnectionConfig = PeerConfig & {
  preferedIslandId?: string
}

const commsMessageType: PeerMessageType = {
  name: 'sceneComms',
  ttl: 10,
  expirationTime: 10 * 1000,
  optimistic: true
}

const VoiceType: PeerMessageType = {
  name: 'voice',
  ttl: 5,
  optimistic: true,
  discardOlderThan: 2000,
  expirationTime: 10000
}

function ProfileRequestResponseType(action: 'request' | 'response'): PeerMessageType {
  return {
    name: 'profile_' + action,
    ttl: 10,
    optimistic: true,
    discardOlderThan: 0,
    expirationTime: 10000
  }
}

declare let globalThis: any

export class LighthouseWorldInstanceConnection implements RoomConnection {
  events = mitt<CommsEvents>()

  private peer: PeerType

  private rooms: string[] = []
  private disposed = false

  constructor(
    private lighthouseUrl: string,
    private peerConfig: LighthouseConnectionConfig,
    private statusHandler: (status: CommsStatus) => void
  ) {
    // This assignment is to "definetly initialize" peer
    this.peer = this.initializePeer()
  }

  async connect() {
    try {
      if (!this.peer.connectedCount()) {
        await this.peer.awaitConnectionEstablished(60000)
      }
      this.statusHandler({ status: 'connected', connectedPeers: this.connectedPeersCount() })
      await this.syncRoomsWithPeer()
    } catch (e: any) {
      logger.error('Error while connecting to layer', e)
      this.statusHandler({
        status: e.responseJson && e.responseJson.status === 'layer_is_full' ? 'realm-full' : 'error',
        connectedPeers: this.connectedPeersCount()
      })
      await this.disconnect()
    }
  }

  async disconnect() {
    if (this.disposed) return
    this.disposed = true

    await this.peer.dispose()

    this.events.emit('DISCONNECTION')
  }

  async sendInitialMessage(address: string, profileType: ProfileType) {
    await this.sendProfileData(address, profileType, 0, address, 'initialProfile')
  }

  async sendProfileMessage(currentPosition: Position, address: string, profileType: ProfileType, version: number) {
    const topic = positionHash(currentPosition)

    await this.sendProfileData(address, profileType, version, topic, 'profile')
  }

  async sendProfileRequest(currentPosition: Position, userId: string, version: number | undefined): Promise<void> {
    const topic = positionHash(currentPosition)

    const profileRequestData = new ProfileRequestData()
    profileRequestData.setUserId(userId)
    profileRequestData.setProfileVersion(version?.toString() ?? '')

    await this.sendData(topic, profileRequestData, ProfileRequestResponseType('request'))
  }

  async sendProfileResponse(currentPosition: Position, profile: Avatar): Promise<void> {
    const topic = positionHash(currentPosition)

    const profileResponseData = new ProfileResponseData()
    profileResponseData.setSerializedProfile(JSON.stringify(profile))

    await this.sendData(topic, profileResponseData, ProfileRequestResponseType('response'))
  }

  async sendPositionMessage(p: Position) {
    const topic = positionHash(p)

    await this.sendPositionData(p, topic, 'position')
  }

  async sendParcelUpdateMessage(currentPosition: Position, p: Position) {
    const topic = positionHash(currentPosition)

    await this.sendPositionData(p, topic, 'parcelUpdate')
  }

  async sendParcelSceneCommsMessage(sceneId: string, message: string) {
    const topic = sceneId

    const sceneData = new SceneData()
    sceneData.setSceneId(sceneId)
    sceneData.setText(message)

    await this.sendData(topic, sceneData, commsMessageType)
  }

  async sendVoiceMessage(currentPosition: Position, frame: EncodedFrame): Promise<void> {
    const topic = positionHash(currentPosition)

    const voiceData = new VoiceData()
    voiceData.setEncodedSamples(frame.encoded)
    voiceData.setIndex(frame.index)

    await this.sendData(topic, voiceData, VoiceType)
  }

  async sendChatMessage(currentPosition: Position, messageId: string, text: string) {
    const topic = positionHash(currentPosition)

    const chatMessage = new ChatData()
    chatMessage.setMessageId(messageId)
    chatMessage.setText(text)

    await this.sendData(topic, chatMessage, PeerMessageTypes.reliable('chat'))
  }

  async setTopics(rooms: string[]) {
    this.rooms = rooms
    await this.syncRoomsWithPeer()
  }

  private async syncRoomsWithPeer() {
    const currentRooms = [...this.peer.currentRooms]

    function isSameRoom(roomId: string, roomIdOrObject: string) {
      return roomIdOrObject === roomId
    }

    const joining = this.rooms.map((room) => {
      if (!currentRooms.some((current) => isSameRoom(room, current))) {
        return this.peer.joinRoom(room)
      } else {
        return Promise.resolve()
      }
    })
    const leaving = currentRooms.map((current) => {
      if (!this.rooms.some((room) => isSameRoom(room, current))) {
        return this.peer.leaveRoom(current)
      } else {
        return Promise.resolve()
      }
    })
    return Promise.all([...joining, ...leaving])
  }

  private async sendData(topic: string, messageData: MessageData, type: PeerMessageType) {
    if (this.disposed) {
      return
    }
    try {
      await this.peer.sendMessage(topic, createCommsMessage(messageData).serializeBinary(), type)
    } catch (e: any) {
      const message = e.message
      if (typeof message === 'string' && message.startsWith('cannot send a message in a room not joined')) {
        // We can ignore this error. This is usually just a problem of eventual consistency.
        // And when it is not, it is usually caused by another error that we might find above. Effectively, we are just making noise.
      } else {
        throw e
      }
    }
  }

  private async sendPositionData(p: Position, topic: string, typeName: string) {
    const positionData = createPositionData(p)
    await this.sendData(topic, positionData, PeerMessageTypes.unreliable(typeName))
  }

  private async sendProfileData(
    address: string,
    profileType: ProfileType,
    version: number,
    topic: string,
    typeName: string
  ) {
    const profileData = createProfileData(address, profileType, version)
    await this.sendData(topic, profileData, PeerMessageTypes.unreliable(typeName))
  }

  private initializePeer() {
    this.statusHandler({ status: 'connecting', connectedPeers: this.connectedPeersCount() })
    this.peer = this.createPeer()
    globalThis.__DEBUG_PEER = this.peer

    if (this.peerConfig.preferedIslandId) {
      this.peer.setPreferedIslandId(this.peerConfig.preferedIslandId)
    }

    return this.peer
  }

  private connectedPeersCount(): number {
    return this.peer ? this.peer.connectedCount() : 0
  }

  private createPeer(): PeerType {
    const statusHandler = (status: PeerStatus): void =>
      this.statusHandler({ status, connectedPeers: this.connectedPeersCount() })

    // Island based peer based peer
    if (this.peerConfig.eventsHandler) {
      this.peerConfig.eventsHandler.statusHandler = statusHandler
    } else {
      this.peerConfig.eventsHandler = {
        statusHandler
      }
    }

    // We require a version greater than 0.1 to not send an ID
    return new IslandBasedPeer(this.lighthouseUrl, undefined, this.peerCallback, this.peerConfig)
  }

  private peerCallback: PacketCallback = (sender, room, payload, _packet) => {
    if (this.disposed) return
    try {
      const commsMessage = CommsMessage.deserializeBinary(payload)
      switch (commsMessage.getDataCase()) {
        case CommsMessage.DataCase.CHAT_DATA:
          this.events.emit(
            'chatMessage',
            createPackage(sender, commsMessage, mapToPackageChat(commsMessage.getChatData()!))
          )
          break
        case CommsMessage.DataCase.POSITION_DATA:
          const positionMessage = mapToPositionMessage(commsMessage.getPositionData()!)
          this.peer.setPeerPosition(sender, positionMessage.slice(0, 3) as [number, number, number])
          this.events.emit('position', createPackage(sender, commsMessage, positionMessage))
          break
        case CommsMessage.DataCase.SCENE_DATA:
          this.events.emit(
            'sceneMessageBus',
            createPackage(sender, commsMessage, mapToPackageScene(commsMessage.getSceneData()!))
          )
          break
        case CommsMessage.DataCase.PROFILE_DATA:
          this.events.emit(
            'profileMessage',
            createPackage(sender, commsMessage, mapToPackageProfile(commsMessage.getProfileData()!))
          )
          break
        case CommsMessage.DataCase.VOICE_DATA:
          this.events.emit(
            'voiceMessage',
            createPackage(
              sender,
              commsMessage,
              mapToPackageVoice(
                commsMessage.getVoiceData()!.getEncodedSamples_asU8(),
                commsMessage.getVoiceData()!.getIndex()
              )
            )
          )
          break
        case CommsMessage.DataCase.PROFILE_REQUEST_DATA:
          this.events.emit(
            'profileRequest',
            createPackage(sender, commsMessage, mapToPackageProfileRequest(commsMessage.getProfileRequestData()!))
          )
          break
        case CommsMessage.DataCase.PROFILE_RESPONSE_DATA: {
          const profile = ensureAvatarCompatibilityFormat(
            JSON.parse(commsMessage.getProfileResponseData()!.getSerializedProfile()) as Avatar
          )
          if (validateAvatar(profile)) {
            this.events.emit('profileResponse', createPackage(sender, commsMessage, { profile }))
          } else {
            logger.error('Received invalid Avatar schema over comms', profile, validateAvatar.errors)
          }
          break
        }
        default: {
          logger.warn(`message with unknown type received ${commsMessage.getDataCase()}`)
          break
        }
      }
    } catch (e: any) {
      logger.error(`Error processing received message from ${sender}. Topic: ${room}`, e)
    }
  }
}

function createPackage<T>(sender: string, commsMessage: CommsMessage, data: T): Package<T> {
  return {
    sender,
    time: commsMessage.getTime(),
    data
  }
}

function mapToPositionMessage(positionData: PositionData): Position {
  return [
    positionData.getPositionX(),
    positionData.getPositionY(),
    positionData.getPositionZ(),
    positionData.getRotationX(),
    positionData.getRotationY(),
    positionData.getRotationZ(),
    positionData.getRotationW(),
    positionData.getImmediate()
  ]
}

function mapToPackageChat(chatData: ChatData) {
  return {
    id: chatData.getMessageId(),
    text: chatData.getText()
  }
}

function mapToPackageScene(sceneData: SceneData) {
  return {
    id: sceneData.getSceneId(),
    text: sceneData.getText()
  }
}

function mapToPackageProfile(profileData: ProfileData) {
  return {
    user: profileData.getUserId(),
    version: profileData.getProfileVersion(),
    type: mapToPackageProfileType(profileData.getProfileType())
  }
}

function mapToPackageProfileType(profileType: ProfileType) {
  return profileType === ProfileData.ProfileType.LOCAL ? ProfileType.LOCAL : ProfileType.DEPLOYED
}

function mapToPackageProfileRequest(profileRequestData: ProfileRequestData) {
  const versionData = profileRequestData.getProfileVersion()
  return {
    userId: profileRequestData.getUserId(),
    version: versionData !== '' ? versionData : undefined
  }
}

function mapToPackageVoice(encoded: Uint8Array, index: number) {
  return { encoded, index }
}

function createProfileData(address: string, profileType: ProfileType, version: number) {
  const profileData = new ProfileData()
  profileData.setProfileVersion(version ? version.toString() : '')
  profileData.setUserId(address)
  profileData.setProfileType(getProtobufProfileType(profileType))
  return profileData
}

function getProtobufProfileType(profileType: ProfileType) {
  return profileType === ProfileType.LOCAL ? ProfileData.ProfileType.LOCAL : ProfileData.ProfileType.DEPLOYED
}

function createPositionData(p: Position) {
  const positionData = new PositionData()
  positionData.setPositionX(p[0])
  positionData.setPositionY(p[1])
  positionData.setPositionZ(p[2])
  positionData.setRotationX(p[3])
  positionData.setRotationY(p[4])
  positionData.setRotationZ(p[5])
  positionData.setRotationW(p[6])
  positionData.setImmediate(p[7])
  return positionData
}

function createCommsMessage(data: MessageData) {
  const commsMessage = new CommsMessage()
  commsMessage.setTime(Date.now())

  if (data instanceof ChatData) commsMessage.setChatData(data)
  if (data instanceof SceneData) commsMessage.setSceneData(data)
  if (data instanceof ProfileData) commsMessage.setProfileData(data)
  if (data instanceof PositionData) commsMessage.setPositionData(data)
  if (data instanceof VoiceData) commsMessage.setVoiceData(data)
  if (data instanceof ProfileRequestData) commsMessage.setProfileRequestData(data)
  if (data instanceof ProfileResponseData) commsMessage.setProfileResponseData(data)

  return commsMessage
}
