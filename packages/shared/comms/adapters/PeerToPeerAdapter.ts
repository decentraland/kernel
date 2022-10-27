import { Reader } from 'protobufjs/minimal'
import { JoinIslandMessage, LeftIslandMessage } from '@dcl/protocol/out-ts/decentraland/kernel/comms/v3/archipelago.gen'
import { Mesh } from './p2p/Mesh'
import mitt from 'mitt'
import { pickRandom } from './p2p/utils'
import { P2PLogConfig, KnownPeerData } from './p2p/types'
import { CommsAdapterEvents, MinimumCommunicationsAdapter, SendHints } from './types'
import { Position3D } from '@dcl/catalyst-peer'
import { ILogger } from 'shared/logger'
import { listenPeerMessage } from '../logic/subscription-adapter'
import { IRealmAdapter } from '../../realm/types'
import { PeerTopicSubscriptionResultElem } from '@dcl/protocol/out-ts/decentraland/bff/topics_service.gen'
import { Path } from '@dcl/protocol/out-ts/decentraland/bff/routing_service.gen'
import { Packet } from '@dcl/protocol/out-ts/decentraland/kernel/comms/v3/p2p.gen'

export type P2PConfig = {
  islandId: string
  peerId: string
  logger: ILogger
  bff: IRealmAdapter
  logConfig: P2PLogConfig
}

// const MAX_CONNECTION_DISTANCE = 4
// const DISCONNECT_DISTANCE = 5
// const EXPIRATION_LOOP_INTERVAL = 2000
// const KNOWN_PEER_RELAY_EXPIRE_TIME = 30000
const UPDATE_NETWORK_INTERVAL = 30000
// const DEFAULT_TTL = 10
// const DEFAULT_PING_TIMEOUT = 7000
const DEFAULT_TARGET_CONNECTIONS = 4
const DEFAULT_MAX_CONNECTIONS = 6
// const DEFAULT_MESSAGE_EXPIRATION_TIME = 10000

export class PeerToPeerAdapter implements MinimumCommunicationsAdapter {
  public readonly mesh: Mesh
  public readonly events = mitt<CommsAdapterEvents>()
  public logConfig: P2PLogConfig
  public knownPeers: Record<string, KnownPeerData> = {}

  private updatingNetwork: boolean = false
  private updateNetworkTimeoutId: ReturnType<typeof setTimeout> | null = null
  private disposed: boolean = false

  private listeners: { close(): void }[] = []

  // TODO: Update this
  private paths: Path[] = []
  private unreachablePeers: Set<string> = new Set()

  constructor(private config: P2PConfig, peers: Map<string, Position3D>) {
    this.logConfig = config.logConfig

    this.mesh = new Mesh(this.config.bff, this.config.peerId, {
      logger: this.config.logger,
      packetHandler: this.handlePeerPacket.bind(this),
      shouldAcceptOffer: (peerId: string) => {
        if (this.disposed) {
          return false
        }

        if (!this.isKnownPeer(peerId)) {
          if (this.logConfig.debugMesh) {
            this.config.logger.log('Rejecting offer from unknown peer')
          }
          return false
        }

        if (this.mesh.connectedCount() >= DEFAULT_TARGET_CONNECTIONS) {
          if (this.logConfig.debugMesh) {
            this.config.logger.log('Rejecting offer, already enough connections')
          }
          return false
        }

        return true
      },
      logConfig: this.logConfig
    })

    this.scheduleUpdateNetwork()

    peers.forEach((p: Position3D, peerId: string) => {
      if (peerId !== this.config.peerId) {
        this.addKnownPeerIfNotExists({ id: peerId, position: p })
        if (p) {
          this.knownPeers[peerId].position = p
        }
      }
    })
  }

  private async onPeerJoined(message: PeerTopicSubscriptionResultElem) {
    let peerJoinMessage: JoinIslandMessage
    try {
      peerJoinMessage = JoinIslandMessage.decode(Reader.create(message.payload))
    } catch (e) {
      this.config.logger.error('cannot process peer join message', e)
      return
    }

    const peerId = peerJoinMessage.peerId
    if (peerId === this.config.peerId) {
      return
    }

    if (peerJoinMessage.islandId === this.config.islandId) {
      this.config.logger.log(`${peerId} joined ${this.config.islandId}`)

      this.addKnownPeerIfNotExists({ id: peerId })
      this.triggerUpdateNetwork(`peer ${peerId} joined island`)
    } else {
      this.config.logger.warn(
        `peer ${peerId} join ${peerJoinMessage.islandId}, but our current island is ${this.config.islandId}`
      )
    }
  }

  private async onPeerLeft(message: PeerTopicSubscriptionResultElem) {
    let peerLeftMessage: LeftIslandMessage
    try {
      peerLeftMessage = LeftIslandMessage.decode(Reader.create(message.payload))
    } catch (e) {
      this.config.logger.error('cannot process peer left message', e)
      return
    }

    const peerId = peerLeftMessage.peerId

    if (peerLeftMessage.islandId === this.config.islandId) {
      this.config.logger.log(`peer ${peerId} left ${this.config.islandId}`)
      this.disconnectFrom(peerId)
      delete this.knownPeers[peerId]
      this.events.emit('PEER_DISCONNECTED', { address: peerId })
      this.triggerUpdateNetwork(`peer ${peerId} left island`)
    } else {
      this.config.logger.warn(
        `peer ${peerId} left ${peerLeftMessage.islandId}, but our current island is ${this.config.islandId}`
      )
    }
  }

  async connect() {
    this.listeners.push(
      listenPeerMessage(
        this.config.bff.services.comms,
        `island.${this.config.islandId}.peer_join`,
        this.onPeerJoined.bind(this)
      ),
      listenPeerMessage(
        this.config.bff.services.comms,
        `island.${this.config.islandId}.peer_left`,
        this.onPeerLeft.bind(this)
      )
    )

    // TODO: When disconnected need to return from this for
    const listenMessages = async () => {
      for await (const packet of this.config.bff.services.messaging.read({})) {
        this.events.emit('message', {
          address: packet.source,
          data: packet.payload
        })
      }
    }
    listenMessages().catch((error) => {
      console.error(error)
    })

    this.triggerUpdateNetwork(`changed to island ${this.config.islandId}`)
  }

  async disconnect() {
    if (this.disposed) return

    this.disposed = true
    if (this.updateNetworkTimeoutId) {
      clearTimeout(this.updateNetworkTimeoutId)
    }

    for (const listener of this.listeners) {
      listener.close()
    }

    this.knownPeers = {}
    await this.mesh.dispose()
    this.events.emit('DISCONNECTION', { kicked: false })
  }

  async send(payload: Uint8Array, { reliable }: SendHints): Promise<void> {
    if (this.disposed) {
      return
    }

    // TODO: Make it more efficient (only one writer for all packets)
    const packet = Packet.encode({
      payload,
      source: this.config.peerId,
      target: this.paths
    }).finish()

    const peersToSend: Set<string> = firstStep(this.paths, this.config.peerId)

    const peersThroughMS: Set<string> = new Set(this.unreachablePeers)
    for (const neighbor of peersToSend) {
      const success = this.mesh.sendPacketToPeer(neighbor, packet, reliable)
      if (!success) {
        peersThroughMS.add(neighbor)
        allSteps(this.paths, neighbor).forEach((p: string) => peersThroughMS.add(p))
      }
    }

    await this.config.bff.services.messaging.publish({
      packet: {
        payload,
        source: this.config.peerId
      },
      peers: Array.from(peersThroughMS)
    })
  }

  isKnownPeer(peerId: string): boolean {
    return !!this.knownPeers[peerId]
  }

  private async handlePeerPacket(data: Uint8Array, reliable: boolean) {
    if (this.disposed) return

    const packet = Packet.decode(data)

    this.events.emit('message', {
      address: packet.source,
      data: packet.payload
    })

    const peersToSend: Set<string> = firstStep(this.paths, this.config.peerId)

    const peersThroughMS: Set<string> = new Set()
    for (const neighbor of peersToSend) {
      const success = this.mesh.sendPacketToPeer(neighbor, data, reliable)
      if (!success) {
        peersThroughMS.add(neighbor)
        allSteps(this.paths, neighbor).forEach((p: string) => peersThroughMS.add(p))
      }
    }

    await this.config.bff.services.messaging.publish({ packet, peers: Array.from(peersThroughMS) })
  }

  private scheduleUpdateNetwork() {
    if (this.disposed) {
      return
    }
    if (this.updateNetworkTimeoutId) {
      clearTimeout(this.updateNetworkTimeoutId)
    }
    this.updateNetworkTimeoutId = setTimeout(() => {
      this.triggerUpdateNetwork('scheduled network update')
    }, UPDATE_NETWORK_INTERVAL)
  }

  private triggerUpdateNetwork(event: string) {
    this.updateNetwork(event).catch((e) => {
      this.config.logger.warn(`Error updating network after ${event}, ${e} `)
    })
    this.scheduleUpdateNetwork()
  }

  private async updateNetwork(event: string) {
    if (this.updatingNetwork || this.disposed) {
      return
    }

    try {
      this.updatingNetwork = true

      if (this.logConfig.debugUpdateNetwork) {
        this.config.logger.log(`Updating network because of event "${event}"...`)
      }

      this.mesh.checkConnectionsSanity()

      // NOTE(hugo): this operation used to be part of calculateNextNetworkOperation
      // but that was wrong, since no new connected peers will be added after a given iteration
      const neededConnections = DEFAULT_TARGET_CONNECTIONS - this.mesh.connectedCount()
      // If we need to establish new connections because we are below the target, we do that
      if (neededConnections > 0 && this.mesh.connectionsCount() < DEFAULT_MAX_CONNECTIONS) {
        if (this.logConfig.debugUpdateNetwork) {
          this.config.logger.log(
            `Establishing connections to reach target. I need ${neededConnections} more connections`
          )
        }

        const candidates = pickRandom(
          Object.values(this.knownPeers).filter((peer) => {
            return !this.mesh.hasConnectionsFor(peer.id)
          }),
          neededConnections
        )

        if (this.logConfig.debugUpdateNetwork) {
          this.config.logger.log(`Picked connection candidates ${JSON.stringify(candidates)} `)
        }

        const reason = 'I need more connections.'
        await Promise.all(candidates.map((candidate) => this.mesh.connectTo(candidate.id, reason)))
      }

      // If we are over the max amount of connections, we discard some
      const toDisconnect = this.mesh.connectedCount() - DEFAULT_MAX_CONNECTIONS
      if (toDisconnect > 0) {
        if (this.logConfig.debugUpdateNetwork) {
          this.config.logger.log(`Too many connections. Need to disconnect from: ${toDisconnect}`)
        }
        Object.values(this.knownPeers)
          .filter((peer) => this.mesh.isConnectedTo(peer.id))
          .slice(0, toDisconnect)
          .forEach((peer) => this.disconnectFrom(peer.id))
      }
    } finally {
      if (this.logConfig.debugUpdateNetwork) {
        this.config.logger.log('Network update finished')
      }

      this.updatingNetwork = false
    }
  }

  private disconnectFrom(peerId: string) {
    this.mesh.disconnectFrom(peerId)
  }

  private addKnownPeerIfNotExists(peer: KnownPeerData) {
    if (!this.knownPeers[peer.id]) {
      this.knownPeers[peer.id] = peer
    }

    return this.knownPeers[peer.id]
  }
}

function firstStep(paths: Path[], peerId: string): Set<string> {
  const response: Set<string> = new Set()
  for (const path of paths) {
    const peers = path.peers
    const currentIndex = peers.indexOf(peerId)

    if (currentIndex === -1) continue
    if (currentIndex >= peers.length - 1) continue

    response.add(peers[currentIndex + 1])
  }
  return response
}

function allSteps(paths: Path[], peerId: string): Set<string> {
  const response: Set<string> = new Set()
  for (const path of paths) {
    const peers = path.peers
    const currentIndex = peers.indexOf(peerId)

    if (currentIndex === -1) continue
    if (currentIndex >= peers.length - 1) continue

    for (let i = currentIndex + 1; i < peers.length; i++) {
      response.add(peers[i])
    }
  }
  return response
}
