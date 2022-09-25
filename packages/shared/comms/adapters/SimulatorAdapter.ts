import { createUnsafeIdentity } from '@dcl/crypto/dist/crypto'
import { Vector3 } from '@dcl/ecs-math'
import { Avatar } from '@dcl/schemas'
import mitt from 'mitt'
import { generateRandomUserProfile } from 'shared/profiles/sagas'
import {
  AnnounceProfileVersion,
  Chat,
  Position,
  ProfileRequest,
  ProfileResponse,
  Scene,
  Voice
} from 'shared/protocol/kernel/comms/comms-rfc-4.gen'
import { lastPlayerPosition } from 'shared/world/positionThings'
import { CommsEvents, RoomConnection } from '../interface'
import { SendHints } from './types'

export class SimulationRoom implements RoomConnection {
  events = mitt<CommsEvents>()

  tick: any

  peers = new Map<
    string,
    { position: Vector3; identity: ReturnType<typeof createUnsafeIdentity>; profile: Avatar; epoch: number }
  >()

  constructor(param: string) {
    this.tick = setInterval(this.update.bind(this), 60)
  }

  async spawnPeer(): Promise<string> {
    const identity = createUnsafeIdentity()
    const address = identity.address

    const avatar = await generateRandomUserProfile(address)

    this.peers.set(address, {
      identity,
      position: lastPlayerPosition.clone(),
      profile: avatar,
      epoch: 0
    })

    this.events.emit('profileMessage', {
      address,
      data: { profileVersion: 0 },
      time: Date.now()
    })

    return address
  }

  async sendProfileMessage(profile: AnnounceProfileVersion): Promise<void> {}
  async sendProfileRequest(request: ProfileRequest): Promise<void> {
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
  async sendProfileResponse(response: ProfileResponse): Promise<void> {}
  async sendPositionMessage(position: Omit<Position, 'index'>): Promise<void> {}
  async sendParcelSceneMessage(message: Scene): Promise<void> {}
  async sendChatMessage(message: Chat): Promise<void> {}
  async sendVoiceMessage(message: Voice): Promise<void> {}

  update() {
    let i = 0
    for (const [address, peer] of this.peers) {
      i++
      const angle = Math.PI * 2 * (i / this.peers.size) + performance.now() * 0.005

      const target = lastPlayerPosition
        .clone()
        .subtractInPlace(new Vector3(0, 1.6, 0))
        .addInPlace(new Vector3(Math.sin(angle), 0, Math.cos(angle)).scaleInPlace(i / 4))

      const segment = target.subtract(peer.position).scale(0.7)
      peer.position.addInPlace(segment)

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
