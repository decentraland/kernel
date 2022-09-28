import { createUnsafeIdentity } from '@dcl/crypto/dist/crypto'
import { Vector3 } from '@dcl/ecs-math'
import { Avatar } from '@dcl/schemas'
import mitt from 'mitt'
import { generateRandomUserProfile } from 'shared/profiles/sagas'
import {
  AnnounceProfileVersion,
  Chat,
  Packet,
  Position,
  ProfileRequest,
  ProfileResponse,
  Scene,
  Voice
} from 'shared/protocol/kernel/comms/comms-rfc-4.gen'
import { lastPlayerPosition } from 'shared/world/positionThings'
import { CommsEvents, RoomConnection } from '../interface'
import { Rfc4RoomConnection } from '../logic/rfc-4-room-connection'
import { CommsAdapterEvents, SendHints } from './types'

export class SimulationRoom implements RoomConnection {
  events = mitt<CommsEvents>()

  tick: any

  peers = new Map<
    string,
    {
      position: Vector3
      identity: ReturnType<typeof createUnsafeIdentity>
      profile: Avatar
      epoch: number
      positionMessage: Uint8Array
      profileMessage: Uint8Array
    }
  >()

  private roomConnection: Rfc4RoomConnection

  constructor(param: string) {
    this.tick = setInterval(this.update.bind(this), 60)
    const transport = {
      events: mitt<CommsAdapterEvents>(),
      send(data: Uint8Array, hints: SendHints): void {},
      async connect(): Promise<void> {},
      async disconnect(error?: Error): Promise<void> {}
    }
    this.roomConnection = new Rfc4RoomConnection(transport)
  }

  async spawnPeer(): Promise<string> {
    const identity = createUnsafeIdentity()
    const address = identity.address

    const avatar = await generateRandomUserProfile(address)

    this.peers.set(address, {
      identity,
      position: lastPlayerPosition.clone(),
      profile: avatar,
      epoch: 0,
      positionMessage: Packet.encode({
        message: {
          $case: 'position',
          position: {
            positionX: 0,
            positionY: 0,
            positionZ: 1,
            rotationW: 1,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            index: 123213
          }
        }
      }).finish(),
      profileMessage: Packet.encode({
        message: {
          $case: 'profileVersion',
          profileVersion: {
            profileVersion: 1
          }
        }
      }).finish()
    })

    this.events.emit('profileMessage', {
      address,
      data: { profileVersion: 0 },
      time: Date.now()
    })

    return address
  }

  async sendProfileMessage(profile: AnnounceProfileVersion): Promise<void> {
    this.roomConnection.sendProfileMessage(profile)
  }
  async sendProfileRequest(request: ProfileRequest): Promise<void> {
    this.roomConnection.sendProfileRequest(request)
    const peer = this.peers.get(request.address)
    if (peer) {
      setTimeout(() => {
        this.events.emit('profileResponse', {
          address: request.address,
          data: { serializedProfile: JSON.stringify(peer.profile) },
          time: Date.now()
        })
      }, Math.random() * 100)
    }
  }
  async sendProfileResponse(response: ProfileResponse): Promise<void> {
    this.roomConnection.sendProfileResponse(response)
  }
  async sendPositionMessage(position: Omit<Position, 'index'>): Promise<void> {
    this.roomConnection.sendPositionMessage(position)
  }
  async sendParcelSceneMessage(message: Scene): Promise<void> {
    this.roomConnection.sendParcelSceneMessage(message)
  }
  async sendChatMessage(message: Chat): Promise<void> {
    this.roomConnection.sendChatMessage(message)
  }
  async sendVoiceMessage(message: Voice): Promise<void> {
    this.roomConnection.sendVoiceMessage(message)
  }

  update() {
    let i = 0

    for (const [address, peer] of this.peers) {
      i++
      const angle = Math.PI * 2 * (i / this.peers.size) + performance.now() * 0.0001

      const target = lastPlayerPosition
        .clone()
        .subtractInPlace(new Vector3(0, 1.6, 0))
        .addInPlace(new Vector3(Math.sin(angle), 0, Math.cos(angle)).scaleInPlace(i * 0.5 + 3))

      const distance = target.subtract(peer.position).length()
      const segment = target
        .subtract(peer.position)
        .normalize()
        .scaleInPlace(Math.min(distance + Math.random(), 5))
      peer.position.addInPlace(segment)

      Packet.decode(peer.positionMessage)

      this.events.emit('position', {
        address,
        data: {
          positionX: peer.position.x,
          positionY: peer.position.y,
          positionZ: peer.position.z,
          rotationW: 1,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          index: peer.epoch++
        },
        time: Date.now()
      })

      if (Math.random() > 0.8) {
        Packet.decode(peer.profileMessage)
        this.events.emit('profileMessage', {
          address,
          data: { profileVersion: peer.epoch },
          time: Date.now()
        })
      }
    }
  }

  async disconnect(error?: Error | undefined): Promise<void> {
    clearInterval(this.tick)
  }

  send(data: Uint8Array, hints: SendHints): void {}

  async connect(): Promise<void> {
    await Promise.all(new Array(100).fill(0).map(() => this.spawnPeer()))
  }
}
