import { Writer } from 'protobufjs/minimal'
import { JoinIslandMessage, LeftIslandMessage } from '@dcl/protocol/out-ts/decentraland/kernel/comms/v3/archipelago.gen'
import { Mesh } from './p2p/Mesh'
import mitt from 'mitt'
import { pickRandom } from './p2p/utils'
import { P2PLogConfig, KnownPeerData } from './p2p/types'
import { CommsAdapterEvents, MinimumCommunicationsAdapter, SendHints } from './types'
import { Position3D } from '@dcl/catalyst-peer'
import { ILogger } from 'shared/logger'
import { listenSystemMessage, listenPeerMessage } from '../logic/subscription-adapter'
import { IRealmAdapter } from '../../realm/types'
import {
  PeerTopicSubscriptionResultElem,
  SystemTopicSubscriptionResultElem
} from '@dcl/protocol/out-ts/decentraland/bff/topics_service.gen'
import { Packet, Edge, MeshUpdateMessage } from '@dcl/protocol/out-ts/decentraland/kernel/comms/v3/p2p.gen'
import { createConnectionsGraph, Graph } from './p2p/graph'

export type P2PConfig = {
  islandId: string
  peerId: string
  logger: ILogger
  bff: IRealmAdapter
  logConfig: P2PLogConfig
}

const MESH_UPDATE_FREQ = 3 * 1000
const UPDATE_NETWORK_INTERVAL = 30000
const DEFAULT_TARGET_CONNECTIONS = 4
const DEFAULT_MAX_CONNECTIONS = 6

// shared writer to leverage pools
const writer = new Writer()

function craftMessage(packet: Packet): Uint8Array {
  writer.reset()
  Packet.encode(packet as any, writer)
  return writer.finish()
}

function craftUpdateMessage(update: MeshUpdateMessage): Uint8Array {
  writer.reset()
  MeshUpdateMessage.encode(update as any, writer)
  return writer.finish()
}

export class PeerToPeerAdapter implements MinimumCommunicationsAdapter {
  public readonly mesh: Mesh
  public readonly events = mitt<CommsAdapterEvents>()
  public logConfig: P2PLogConfig
  public knownPeers = new Map<string, KnownPeerData>()

  private updatingNetwork: boolean = false
  private updateNetworkTimeoutId: ReturnType<typeof setTimeout> | null = null
  private shareMeshInterval: ReturnType<typeof setInterval> | null = null
  private disposed: boolean = false

  private listeners: { close(): void }[] = []

  private graph: Graph

  constructor(private config: P2PConfig, peers: Map<string, Position3D>) {
    this.logConfig = config.logConfig
    this.graph = createConnectionsGraph(config.peerId)

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

        if (this.mesh.connectionsCount() >= DEFAULT_MAX_CONNECTIONS) {
          if (this.logConfig.debugMesh) {
            this.config.logger.log('Rejecting offer, already enough connections')
          }
          return false
        }

        return true
      },
      logConfig: this.logConfig,
      onConnectionEstablished: (peerId: string) => {
        this.graph.addConnection(this.config.peerId, peerId)
        this.sendMeshUpdate({
          source: this.config.peerId,
          data: {
            $case: 'connectedTo',
            connectedTo: peerId
          }
        })
      },
      onConnectionClosed: (peerId: string) => {
        this.graph.removeConnection(this.config.peerId, peerId)
        this.sendMeshUpdate({
          source: this.config.peerId,
          data: {
            $case: 'disconnectedFrom',
            disconnectedFrom: peerId
          }
        })
      }
    })

    this.scheduleUpdateNetwork()

    peers.forEach((p: Position3D, peerId: string) => {
      if (peerId !== this.config.peerId) {
        this.addKnownPeerIfNotExists({ id: peerId, position: p })
        if (p) {
          this.knownPeers.get(peerId)!.position = p
        }
      }
    })

    this.shareMeshInterval = setInterval(() => {
      if (this.disposed) {
        return
      }
      this.sendMeshUpdate({
        source: this.config.peerId,
        data: {
          $case: 'status',
          status: {
            connectedTo: this.mesh.connectedPeerIds()
          }
        }
      })
    }, MESH_UPDATE_FREQ)
  }

  private async onPeerJoined(message: SystemTopicSubscriptionResultElem) {
    let peerJoinMessage: JoinIslandMessage
    try {
      peerJoinMessage = JoinIslandMessage.decode(message.payload)
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

  private async onMeshChanged(message: PeerTopicSubscriptionResultElem) {
    const { data, source } = MeshUpdateMessage.decode(message.payload)
    if (source === this.config.peerId) {
      return
    }

    switch (data?.$case) {
      case 'disconnectedFrom': {
        if (data.disconnectedFrom !== this.config.peerId) {
          this.graph.removeConnection(source, data.disconnectedFrom)
        }
        break
      }
      case 'connectedTo': {
        if (data.connectedTo !== this.config.peerId) {
          this.graph.addConnection(source, data.connectedTo)
        }
        break
      }
      case 'status': {
        for (const p of this.knownPeers.keys()) {
          if (p === this.config.peerId) {
            continue
          }
          if (data.status.connectedTo.includes(p)) {
            this.graph.addConnection(source, p)
          } else {
            this.graph.removeConnection(source, p)
          }
        }
        break
      }
    }
  }

  private async onFallback(message: PeerTopicSubscriptionResultElem) {
    const packet = Packet.decode(message.payload)
    this.events.emit('message', {
      address: packet.source,
      data: packet.payload
    })
  }

  private async onPeerLeft(message: SystemTopicSubscriptionResultElem) {
    let peerLeftMessage: LeftIslandMessage
    try {
      peerLeftMessage = LeftIslandMessage.decode(message.payload)
    } catch (e) {
      this.config.logger.error('cannot process peer left message', e)
      return
    }

    const peerId = peerLeftMessage.peerId
    this.graph.removePeer(peerId)

    if (peerLeftMessage.islandId === this.config.islandId) {
      this.config.logger.log(`peer ${peerId} left ${this.config.islandId}`)
      this.disconnectFrom(peerId)
      this.knownPeers.delete(peerId)
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
      listenSystemMessage(
        this.config.bff.services.comms,
        `island.${this.config.islandId}.peer_join`,
        this.onPeerJoined.bind(this)
      ),
      listenSystemMessage(
        this.config.bff.services.comms,
        `island.${this.config.islandId}.peer_left`,
        this.onPeerLeft.bind(this)
      ),
      listenPeerMessage(
        this.config.bff.services.comms,
        `island.${this.config.islandId}.mesh`,
        this.onMeshChanged.bind(this)
      ),
      listenPeerMessage(this.config.bff.services.comms, `${this.config.peerId}.fallback`, this.onFallback.bind(this))
    )

    this.triggerUpdateNetwork(`changed to island ${this.config.islandId}`)
  }

  async disconnect() {
    if (this.disposed) return

    this.disposed = true
    if (this.updateNetworkTimeoutId) {
      clearTimeout(this.updateNetworkTimeoutId)
    }

    if (this.shareMeshInterval) {
      clearInterval(this.shareMeshInterval)
    }

    for (const listener of this.listeners) {
      listener.close()
    }

    this.knownPeers.clear()
    await this.mesh.dispose()
    this.events.emit('DISCONNECTION', { kicked: false })
  }

  async send(payload: Uint8Array, { reliable }: SendHints): Promise<void> {
    if (this.disposed) {
      return
    }
    const edges = this.graph.getMST()
    const reachablePeers = this.graph.getReachablePeers()
    const packet = craftMessage({
      payload,
      source: this.config.peerId,
      edges
    })

    const peersToSend: Set<string> = nextSteps(edges, this.config.peerId)

    for (const neighbor of peersToSend) {
      if (!this.mesh.sendPacketToPeer(neighbor, packet, reliable)) {
        // TODO metric
        this.config.logger.warn(`cannot send package to ${neighbor}`)
      }
    }

    for (const peerId of this.knownPeers.keys()) {
      if (!reachablePeers.has(peerId)) {
        // TODO: metric
        this.config.bff.services.comms
          .publishToTopic({
            topic: `${this.config.peerId}.fallback`,
            payload: packet
          })
          .catch((err) => this.config.logger.error(err))
      }
    }
  }

  isKnownPeer(peerId: string): boolean {
    return !!this.knownPeers.get(peerId)
  }

  private async handlePeerPacket(data: Uint8Array, reliable: boolean) {
    if (this.disposed) return

    const packet = Packet.decode(data)

    this.events.emit('message', {
      address: packet.source,
      data: packet.payload
    })

    const peersToSend: Set<string> = nextSteps(packet.edges, this.config.peerId)

    for (const neighbor of peersToSend) {
      if (!this.mesh.sendPacketToPeer(neighbor, data, reliable)) {
        // TODO: metric
        this.config.logger.warn(`cannot relay package to ${neighbor}`)
      }
    }
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

      const neededConnections = Math.min(
        DEFAULT_TARGET_CONNECTIONS - this.mesh.connectedCount(),
        DEFAULT_MAX_CONNECTIONS - this.mesh.connectionsCount()
      )
      // If we need to establish new connections because we are below the target, we do that
      if (neededConnections > 0) {
        if (this.logConfig.debugUpdateNetwork) {
          this.config.logger.log(
            `Establishing connections to reach target. I need ${neededConnections} more connections`
          )
        }

        const candidates = pickRandom(
          Array.from(this.knownPeers.values()).filter((peer) => {
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
        Array.from(this.knownPeers.values())
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

  private sendMeshUpdate(update: MeshUpdateMessage) {
    this.config.bff.services.comms
      .publishToTopic({
        topic: `island.${this.config.islandId}.mesh`,
        payload: craftUpdateMessage(update)
      })
      .catch((err) => this.config.logger.error(err))
  }

  private addKnownPeerIfNotExists(peer: KnownPeerData) {
    if (!this.knownPeers.has(peer.id)) {
      this.knownPeers.set(peer.id, peer)
    }

    return this.knownPeers.get(peer.id)!
  }
}

function nextSteps(edges: Edge[], peerId: string): Set<string> {
  const response: Set<string> = new Set()
  for (const edge of edges) {
    if (edge.u === peerId) {
      response.add(edge.v)
    }
  }
  return response
}
