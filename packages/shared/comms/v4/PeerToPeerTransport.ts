import { store } from 'shared/store/isolatedStore'
import { future, IFuture } from 'fp-future'
import { getCommsConfig } from 'shared/meta/selectors'
import { Message } from 'google-protobuf'
import { SendOpts, Transport } from './Transport'
import { lastPlayerPositionReport } from 'shared/world/positionThings'

import { JoinIslandMessage, LeftIslandMessage } from './proto/archipelago_pb'
import { SuspendRelayData, PingData, PongData, Packet, MessageData } from './proto/p2p_pb'

import { Mesh } from './Mesh'

import { removePeerByUUID } from '../peers'
import {
  PeerMessageType,
  PongMessageType,
  PingMessageType,
  PeerMessageTypes,
  SuspendRelayType,
  PeerRelayData,
  discretizedPositionDistanceXZ,
  PingResult
} from '@dcl/catalyst-peer'

import { Position3D } from './types'

import { createLogger } from 'shared/logger'
import { BFFConnection, TopicListener } from './BFFConnection'

const logger = createLogger('CommsV4:P2P: ')

const MAX_UINT32 = 4294967295

function randomUint32() {
  return Math.floor(Math.random() * MAX_UINT32)
}

/**
 * Picks the top `count` elements according to `criteria` from the array and returns them and the remaining elements. If the array
 * has less or equal elements than the amount required, then it returns a copy of the array sorted by `criteria`.
 */
function pickBy<T>(array: T[], count: number, criteria: (t1: T, t2: T) => number): [T[], T[]] {
  const sorted = array.sort(criteria)

  const selected = sorted.splice(0, count)

  return [selected, sorted]
}

type PacketSubtypeData = {
  lastTimestamp: number
  lastSequenceId: number
}

type PeerRelay = { id: string; hops: number; timestamp: number }

type KnownPeerData = {
  id: string
  lastUpdated?: number // Local timestamp used for registering if the peer is alive
  timestamp?: number // Their local timestamp used for handling packets
  subtypeData: Record<string, PacketSubtypeData>
  position?: Position3D
  latency?: number
  hops?: number
  reachableThrough: Record<string, PeerRelay>
}

type MinPeerData = { id: string; position?: Position3D }

type NetworkOperation = () => Promise<KnownPeerData[]>

type PacketData = {
  messageData?: MessageData,
  pingData?: PingData,
  pongData?: PongData,
  suspendRelayData?: SuspendRelayData
}

type ActivePing = {
  results: PingResult[]
  startTime?: number
  future: IFuture<PingResult[]>
}

const EXPIRATION_LOOP_INTERVAL = 2000
const KNOWN_PEERS_EXPIRE_TIME = 90000
const KNOWN_PEER_RELAY_EXPIRE_TIME = 30000
const UPDATE_NETWORK_INTERVAL = 30000
const DEFAULT_TTL = 10
const DEFAULT_PING_TIMEOUT = 7000
const DEFAULT_TARGET_CONNECTIONS = 4
const DEFAULT_MAX_CONNECTIONS = 6
const DEFAULT_MESSAGE_EXPIRATION_TIME = 10000

type RelaySuspensionConfig = {
  relaySuspensionInterval: number
  relaySuspensionDuration: number
}

type Config = {
  maxConnectionDistance: number
  nearbyPeersDistance: number
  disconnectDistance: number
  distance: (l1: Position3D, l2: Position3D) => number
  relaySuspensionConfig?: RelaySuspensionConfig
}

export class PeerToPeerTransport extends Transport {
  private mesh: Mesh
  private peerRelayData: Record<string, PeerRelayData> = {}
  private knownPeers: Record<string, KnownPeerData> = {}
  private receivedPackets: Record<string, { timestamp: number; expirationTime: number }> = {}
  private updatingNetwork: boolean = false
  private currentMessageId: number = 0
  private instanceId: number
  private expireTimeoutId: NodeJS.Timeout | number
  private updateNetworkTimeoutId: NodeJS.Timeout | number
  private pingTimeoutId?: NodeJS.Timeout | number
  private disposed: boolean = false
  private activePings: Record<string, ActivePing> = {}
  private config: Config

  private onPeerJoinedListener: TopicListener | null
  private onPeerLeftListener: TopicListener | null

  constructor(
    private peerId: string,
    private bffConnection: BFFConnection,
    private islandId: string,
    peers: Map<string, Position3D>
  ) {
    super()
    const commsConfig = getCommsConfig(store.getState())
    this.config = {
      maxConnectionDistance: 4,
      nearbyPeersDistance: 5,
      disconnectDistance: 5,
      distance: discretizedPositionDistanceXZ()
    }
    if (!commsConfig.relaySuspensionDisabled) {
      this.config.relaySuspensionConfig = {
        relaySuspensionInterval: commsConfig.relaySuspensionInterval ?? 750,
        relaySuspensionDuration: commsConfig.relaySuspensionDuration ?? 5000
      }
    }

    this.instanceId = randomUint32()

    this.mesh = new Mesh(this.bffConnection, this.peerId, {
      packetHandler: this.handlePeerPacket.bind(this),
      isKnownPeer: (peerId: string) => !!this.knownPeers[peerId]
    })

    const scheduleExpiration = () =>
      setTimeout(() => {
        try {
          this.expireMessages()
          this.expirePeers()
        } catch (e) {
          logger.error(`Couldn't expire messages ${e}`)
        } finally {
          this.expireTimeoutId = scheduleExpiration()
        }
      }, EXPIRATION_LOOP_INTERVAL)

    const scheduleUpdateNetwork = () =>
      setTimeout(() => {
        this.triggerUpdateNetwork('scheduled network update')
        this.updateNetworkTimeoutId = scheduleUpdateNetwork()
      }, UPDATE_NETWORK_INTERVAL)

    this.expireTimeoutId = scheduleExpiration()
    this.updateNetworkTimeoutId = scheduleUpdateNetwork()

    // if (this.config.pingInterval) {
    //   const schedulePing = () =>
    //     setTimeout(async () => {
    //       try {
    //         await this.ping()
    //       } finally {
    //         this.pingTimeoutId = schedulePing()
    //       }
    //     }, this.config.pingInterval)

    //   this.pingTimeoutId = schedulePing()
    // }

    this.onPeerJoinedListener = this.bffConnection.addListener(`island.${this.islandId}.peer_join`, this.onPeerJoined.bind(this))
    this.onPeerLeftListener = this.bffConnection.addListener(`island.${this.islandId}.peer_left`, this.onPeerLeft.bind(this))
    this.bffConnection.refreshTopics()

    peers.forEach((p: Position3D, peerId: string) => {
      if (peerId !== this.peerId) {
        this.addKnownPeerIfNotExists({ id: peerId, position: p })
        if (p) {
          this.knownPeers[peerId].position = p
        }
      }
    })

    globalThis.__DEBUG_PEER = this
  }

  onPeerPositionChange(peerId: string, p: Position3D) {
    const peer = this.knownPeers[peerId]
    if (peer) {
      peer.position = p
    }
  }

  private onPeerJoined(data: Uint8Array) {
    let peerJoinMessage: JoinIslandMessage
    try {
      peerJoinMessage = JoinIslandMessage.deserializeBinary(data)
    } catch (e) {
      logger.error('cannot process peer join message', e)
      return
    }

    const islandId = peerJoinMessage.getIslandId()
    const peerId = peerJoinMessage.getPeerId()

    if (islandId === this.islandId) {
      logger.log(`peer ${peerId} joined ${islandId}`)

      this.addKnownPeerIfNotExists({ id: peerId })
      this.triggerUpdateNetwork(`peer ${peerId} joined island`)
    } else {
      logger.warn(`peer ${peerId} join ${islandId}, but our current island is ${this.islandId}`)
    }
  }

  private onPeerLeft(data: Uint8Array) {
    let peerLeftMessage: LeftIslandMessage
    try {
      peerLeftMessage = LeftIslandMessage.deserializeBinary(data)
    } catch (e) {
      logger.error('cannot process peer left message', e)
      return
    }

    const islandId = peerLeftMessage.getIslandId()
    const peerId = peerLeftMessage.getPeerId()

    if (islandId === this.islandId) {
      logger.log(`peer ${peerId} left ${this.islandId}`)
      this.disconnectFrom(peerId)
      this.removeKnownPeer(peerId)
      this.triggerUpdateNetwork(`peer ${peerId} left island`)
      removePeerByUUID(peerId)
    } else {
      logger.warn(`peer ${peerId} left ${islandId}, but our current island is ${this.islandId}`)
    }
  }

  async connect() {
    this.triggerUpdateNetwork(`changed to island ${this.islandId}`)
  }

  async disconnect() {
    if (this.disposed) return

    this.disposed = true
    clearTimeout(this.updateNetworkTimeoutId as any)
    clearTimeout(this.expireTimeoutId as any)
    clearTimeout(this.pingTimeoutId as any)

    if (this.onPeerJoinedListener) {
      this.bffConnection.removeListener(this.onPeerJoinedListener)
    }
    if (this.onPeerLeftListener) {
      this.bffConnection.removeListener(this.onPeerLeftListener)
    }

    this.knownPeers = {}
    await this.mesh.dispose()
    this.onDisconnectObservable.notifyObservers()
  }

  async send(msg: Message, { reliable }: SendOpts): Promise<void> {
    if (this.disposed) {
      return
    }
    try {
      const t = reliable ? PeerMessageTypes.reliable('data') : PeerMessageTypes.unreliable('data')
      await this.sendMessage(this.islandId, msg.serializeBinary(), t)
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

  private handlePeerPacket(data: Uint8Array, peerId: string) {
    if (this.disposed) return
    try {

      const packet = Packet.deserializeBinary(data)

      const packetKey = `${packet.getSrc()}_${packet.getInstanceId()}_${packet.getSequenceId()}`
      const alreadyReceived = !!this.receivedPackets[packetKey]

      this.ensureAndUpdateKnownPeer(packet, peerId)

      if (packet.getDiscardOlderThan() !== 0) {
        // If discardOlderThan is zero, then we don't need to store the package.
        // Same or older packages will be instantly discarded
        this.receivedPackets[packetKey] = {
          timestamp: Date.now(),
          expirationTime: this.getExpireTime(packet)
        }
      }

      const expired = this.checkExpired(packet)

      if (packet.getHops() >= 1) {
        this.countRelay(peerId, packet, expired, alreadyReceived)
      }

      if (!alreadyReceived && !expired) {
        this.processPacket(packet)
      } else {
        this.requestRelaySuspension(packet, peerId)
      }
    } catch (e: any) {
      logger.warn(`Failed to process message from: ${peerId} ${e.toString()}`)
    }
  }

  private processPacket(packet: Packet) {
    this.updateTimeStamp(packet.getSrc(), packet.getSubtype(), packet.getTimestamp(), packet.getSequenceId())

    const hops = packet.getHops() + 1
    packet.setHops(hops)

    this.knownPeers[packet.getSrc()].hops = hops

    if (hops < packet.getTtl()) {
      this.sendPacket(packet)
    }

    const messageData = packet.getMessageData()
    if (messageData && messageData.getRoom() === this.islandId) {
      this.onMessageObservable.notifyObservers({
        peer: packet.getSrc(),
        data: messageData.getPayload_asU8()
      })
    }

    const pingData = packet.getPingData()
    if (pingData) {
      this.respondPing(pingData.getPingId())
    }

    const pongData = packet.getPongData()
    if (pongData) {
      this.processPong(packet.getSrc(), pongData.getPingId())
    }

    const suspendRelayData = packet.getSuspendRelayData()
    if (suspendRelayData) {
      this.processSuspensionRequest(packet.getSrc(), suspendRelayData)
    }
  }

  private expireMessages() {
    const currentTimestamp = Date.now()

    const keys = Object.keys(this.receivedPackets)

    keys.forEach((id) => {
      const received = this.receivedPackets[id]
      if (currentTimestamp - received.timestamp > received.expirationTime) {
        delete this.receivedPackets[id]
      }
    })
  }

  private expirePeers() {
    const currentTimestamp = Date.now()

    this.expireKnownPeers(currentTimestamp)
    this.expirePeerRelayData(currentTimestamp)
  }


  private expirePeerRelayData(currentTimestamp: number) {
    Object.keys(this.peerRelayData).forEach((id) => {
      const connected = this.peerRelayData[id]
      // We expire peers suspensions
      Object.keys(connected.ownSuspendedRelays).forEach((srcId) => {
        if (connected.ownSuspendedRelays[srcId] <= currentTimestamp) {
          delete connected.ownSuspendedRelays[srcId]
        }
      })

      Object.keys(connected.theirSuspendedRelays).forEach((srcId) => {
        if (connected.theirSuspendedRelays[srcId] <= currentTimestamp) {
          delete connected.theirSuspendedRelays[srcId]
        }
      })
    })
  }

  private expireKnownPeers(currentTimestamp: number) {
    Object.keys(this.knownPeers).forEach((id) => {
      const lastUpdate = this.knownPeers[id].lastUpdated
      if (lastUpdate && currentTimestamp - lastUpdate > KNOWN_PEERS_EXPIRE_TIME) {
        if (this.isConnectedTo(id)) {
          this.disconnectFrom(id)
        }
        delete this.knownPeers[id]
      } else {
        // We expire reachable through data
        Object.keys(this.knownPeers[id].reachableThrough).forEach((relayId) => {
          if (
            currentTimestamp - this.knownPeers[id].reachableThrough[relayId].timestamp >
            KNOWN_PEER_RELAY_EXPIRE_TIME
          ) {
            delete this.knownPeers[id].reachableThrough[relayId]
          }
        })
      }
    })
  }

  private updateTimeStamp(peerId: string, subtype: string | undefined, timestamp: number, sequenceId: number) {
    const knownPeer = this.knownPeers[peerId]
    knownPeer.lastUpdated = Date.now()
    knownPeer.timestamp = Math.max(knownPeer.timestamp ?? Number.MIN_SAFE_INTEGER, timestamp)
    if (subtype) {
      const lastData = knownPeer.subtypeData[subtype]
      knownPeer.subtypeData[subtype] = {
        lastTimestamp: Math.max(lastData?.lastTimestamp ?? Number.MIN_SAFE_INTEGER, timestamp),
        lastSequenceId: Math.max(lastData?.lastSequenceId ?? Number.MIN_SAFE_INTEGER, sequenceId)
      }
    }
  }

  private getPeerRelayData(peerId: string) {
    if (!this.peerRelayData[peerId]) {
      this.peerRelayData[peerId] = {
        receivedRelayData: {},
        ownSuspendedRelays: {},
        theirSuspendedRelays: {},
        pendingSuspensionRequests: []
      }
    }

    return this.peerRelayData[peerId]
  }

  private processSuspensionRequest(peerId: string, suspendRelayData: SuspendRelayData) {
    if (this.mesh.hasConnectionsFor(peerId)) {
      const relayData = this.getPeerRelayData(peerId)
      suspendRelayData.getRelayedPeersList().forEach(
        (it) => (relayData.ownSuspendedRelays[it] = Date.now() + suspendRelayData.getDurationMillis())
      )
    }
  }

  private requestRelaySuspension(packet: Packet, peerId: string) {
    const suspensionConfig = this.config.relaySuspensionConfig
    if (suspensionConfig) {
      // First we update pending suspensions requests, adding the new one if needed
      this.consolidateSuspensionRequest(packet, peerId)

      const now = Date.now()

      const relayData = this.getPeerRelayData(peerId)

      const lastSuspension = relayData.lastRelaySuspensionTimestamp

      // We only send suspensions requests if more time than the configured interval has passed since last time
      if (lastSuspension && now - lastSuspension > suspensionConfig.relaySuspensionInterval) {
        const suspendRelayData = new SuspendRelayData()
        suspendRelayData.setRelayedPeersList(relayData.pendingSuspensionRequests)
        suspendRelayData.setDurationMillis(suspensionConfig.relaySuspensionDuration)

        logger.log(`Requesting relay suspension to ${peerId} ${suspendRelayData}`)

        const packet = this.buildPacketWithData(SuspendRelayType, {
          suspendRelayData
        })

        this.sendPacketToPeer(peerId, packet)

        suspendRelayData.getRelayedPeersList().forEach((relayedPeerId) => {
          relayData.theirSuspendedRelays[relayedPeerId] = Date.now() + suspensionConfig.relaySuspensionDuration
        })

        relayData.pendingSuspensionRequests = []
        relayData.lastRelaySuspensionTimestamp = now
      } else if (!lastSuspension) {
        // We skip the first suspension to give time to populate the structures
        relayData.lastRelaySuspensionTimestamp = now
      }
    }
  }

  private consolidateSuspensionRequest(packet: Packet, connectedPeerId: string) {
    const relayData = this.getPeerRelayData(connectedPeerId)
    if (relayData.pendingSuspensionRequests.includes(packet.getSrc())) {
      // If there is already a pending suspension for this src through this connection, we don't do anything
      return
    }

    logger.log(`Consolidating suspension for ${packet.getSrc()}->${connectedPeerId}`)

    const now = Date.now()

    // We get a list of through which connected peers is this src reachable and are not suspended
    const reachableThrough = Object.values(this.knownPeers[packet.getSrc()].reachableThrough).filter(
      (it) =>
        this.isConnectedTo(it.id) &&
        now - it.timestamp < KNOWN_PEER_RELAY_EXPIRE_TIME &&
        !this.isRelayFromConnectionSuspended(it.id, packet.getSrc(), now)
    )

    logger.log(`${packet.getSrc()} is reachable through ${reachableThrough}`)

    // We only suspend if we will have at least 1 path of connection for this peer after suspensions
    if (reachableThrough.length > 1 || (reachableThrough.length === 1 && reachableThrough[0].id !== connectedPeerId)) {
      logger.log(`Will add suspension for ${packet.getSrc()} -> ${connectedPeerId}`)
      relayData.pendingSuspensionRequests.push(packet.getSrc())
    }
  }

  private isRelayFromConnectionSuspended(
    connectedPeerId: string,
    srcId: string,
    now: number = Date.now()
  ): boolean {
    const relayData = this.getPeerRelayData(connectedPeerId)
    return !!(
      relayData.pendingSuspensionRequests.includes(srcId) ||
      // Relays are suspended only if they are not expired
      (relayData.theirSuspendedRelays[srcId] && now < relayData.theirSuspendedRelays[srcId])
    )
  }

  private isRelayToConnectionSuspended(
    connectedPeerId: string,
    srcId: string,
    now: number = Date.now()
  ): boolean {
    const relayData = this.getPeerRelayData(connectedPeerId)
    return !!relayData.ownSuspendedRelays[srcId] && now < relayData.ownSuspendedRelays[srcId]
  }

  private countRelay(peerId: string, packet: Packet, expired: boolean, alreadyReceived: boolean) {
    const relayData = this.getPeerRelayData(peerId)
    let receivedRelayData = relayData.receivedRelayData[packet.getSrc()]
    if (!receivedRelayData) {
      receivedRelayData = relayData.receivedRelayData[packet.getSrc()] = {
        hops: packet.getHops(),
        discarded: 0,
        total: 0
      }
    } else {
      receivedRelayData.hops = packet.getHops()
    }

    receivedRelayData.total += 1

    if (expired || alreadyReceived) {
      receivedRelayData.discarded += 1
    }
  }

  private processPong(peerId: string, pingId: number) {
    const now = performance.now()
    const activePing = this.activePings[pingId]
    if (activePing && activePing.startTime) {
      const elapsed = now - activePing.startTime

      const knownPeer = this.addKnownPeerIfNotExists({ id: peerId })
      knownPeer.latency = elapsed

      activePing.results.push({ peerId, latency: elapsed })
    }
  }

  private respondPing(pingId: number) {
    const pongData = new PongData()
    pongData.setPingId(pingId)

    // TODO: Maybe we should add a destination and handle this message as unicast
    const packet = this.buildPacketWithData(PongMessageType, { pongData })
    packet.setExpireTime(DEFAULT_PING_TIMEOUT)
    this.sendPacket(packet)
  }

  private checkExpired(packet: Packet) {
    const discardedByOlderThan: boolean = this.isDiscardedByOlderThanReceivedPackages(packet)

    let discardedByExpireTime: boolean = false
    const expireTime = this.getExpireTime(packet)

    if (this.knownPeers[packet.getSrc()].timestamp) {
      discardedByExpireTime = this.knownPeers[packet.getSrc()].timestamp! - packet.getTimestamp() > expireTime
    }

    return discardedByOlderThan || discardedByExpireTime
  }

  private isDiscardedByOlderThanReceivedPackages(packet: Packet) {
    if (packet.getDiscardOlderThan() >= 0 && packet.getSubtype()) {
      const subtypeData = this.knownPeers[packet.getSrc()]?.subtypeData[packet.getSubtype()]
      return (
        subtypeData &&
        subtypeData.lastTimestamp - packet.getTimestamp() > packet.getDiscardOlderThan() &&
        subtypeData.lastSequenceId >= packet.getSequenceId()
      )
    }

    return false
  }

  sendMessage(roomId: string, payload: Uint8Array, type: PeerMessageType) {
    if (roomId !== this.islandId) {
      return Promise.reject(new Error(`cannot send a message in a room not joined(${roomId})`))
    }

    const messageData = new MessageData()
    messageData.setRoom(roomId)
    messageData.setPayload(payload)
    const packet = this.buildPacketWithData(type, { messageData })
    this.sendPacket(packet)
  }

  private buildPacketWithData(type: PeerMessageType, data: PacketData) {
    this.currentMessageId += 1
    const sequenceId = this.currentMessageId

    const ttl = typeof type.ttl !== 'undefined' ? typeof type.ttl === 'number' ? type.ttl : type.ttl(sequenceId, type) : DEFAULT_TTL
    const optimistic = typeof type.optimistic === 'boolean' ? type.optimistic : type.optimistic(sequenceId, type)

    const packet = new Packet()
    packet.setSequenceId(sequenceId)
    packet.setInstanceId(this.instanceId)
    packet.setSubtype(type.name)
    packet.setExpireTime(type.expirationTime ?? -1)
    packet.setDiscardOlderThan(type.discardOlderThan ?? -1)
    packet.setTimestamp(Date.now())
    packet.setSrc(this.peerId)
    packet.setHops(0)
    packet.setTtl(ttl)
    packet.setReceivedByList([])
    packet.setOptimistic(optimistic)
    packet.setMessageData(data.messageData)
    packet.setPingData(data.pingData)
    packet.setPongData(data.pongData)
    packet.setSuspendRelayData(data.suspendRelayData)
    return packet
  }

  async ping() {
    if (this.peerId) {
      const pingId = randomUint32()
      const pingFuture = future<PingResult[]>()
      this.activePings[pingId] = {
        results: [],
        future: pingFuture
      }


      const pingData = new PingData()
      pingData.setPingId(pingId)
      const packet = this.buildPacketWithData(PingMessageType, { pingData })
      packet.setExpireTime(DEFAULT_PING_TIMEOUT)
      this.sendPacket(packet)

      setTimeout(() => {
        const activePing = this.activePings[pingId]
        if (activePing) {
          activePing.future.resolve(activePing.results)
          delete this.activePings[pingId]
        }
      }, DEFAULT_PING_TIMEOUT)

      return await pingFuture
    }
  }


  private sendPacket(packet: Packet) {
    const receivedBy = packet.getReceivedByList()
    if (!receivedBy.includes(this.peerId)) {
      receivedBy.push(this.peerId)
      packet.setReceivedByList(receivedBy)
    }

    const peersToSend = this.mesh.fullyConnectedPeerIds().filter(
      (it) =>
        !packet.getReceivedByList().includes(it) && (packet.getHops() === 0 || !this.isRelayToConnectionSuspended(it, packet.getSrc()))
    )

    if (packet.getOptimistic()) {
      packet.setReceivedByList([...packet.getReceivedByList(), ...peersToSend])
    }

    // This is a little specific also, but is here in order to make the measurement as accurate as possible
    const pingData = packet.getPingData()
    if (pingData && packet.getSrc() === this.peerId) {
      const activePing = this.activePings[pingData.getPingId()]
      if (activePing) {
        activePing.startTime = performance.now()
      }
    }

    peersToSend.forEach((peer) => this.sendPacketToPeer(peer, packet))
  }

  private sendPacketToPeer(peer: string, packet: Packet) {
    if (this.isConnectedTo(peer)) {
      try {
        this.mesh.sendPacketToPeer(peer, packet.serializeBinary())
      } catch (e: any) {
        logger.warn(`Error sending data to peer ${peer} ${e.toString()}`)
      }
    }
  }

  private triggerUpdateNetwork(event: string) {
    this.updateNetwork(event).catch((e) => {
      logger.warn(`Error updating network after ${event}, ${e} `)
    })
  }


  private isConnectedTo(peerId: string): boolean {
    return this.mesh.isConnectedTo(peerId)
  }


  private getWorstConnectedPeerByDistance(): [number, string] | undefined {
    return this.mesh.connectedPeerIds().reduce<[number, string] | undefined>((currentWorst, peer) => {
      const currentDistance = this.distanceTo(peer)
      if (typeof currentDistance !== 'undefined') {
        return typeof currentWorst !== 'undefined' && currentWorst[0] >= currentDistance
          ? currentWorst
          : [currentDistance, peer]
      }
    }, undefined)
  }

  private async updateNetwork(event: string) {
    if (this.updatingNetwork || this.disposed) {
      return
    }

    try {
      this.updatingNetwork = true

      logger.log(`Updating network because of event "${event}"...`)

      this.mesh.checkConnectionsSanity()

      let connectionCandidates = Object.values(this.knownPeers).filter((it) => this.isValidConnectionCandidate(it))

      let operation: NetworkOperation | undefined
      while ((operation = this.calculateNextNetworkOperation(connectionCandidates))) {
        try {
          connectionCandidates = await operation()
        } catch (e) {
          // We may want to invalidate the operation or something to avoid repeating the same mistake
          logger.log(`Error performing operation ${operation} ${e} `)
        }
      }
    } finally {
      logger.log('Network update finished')

      this.updatingNetwork = false
    }
  }

  private isValidConnectionCandidate(it: KnownPeerData): boolean {
    return (
      !this.isConnectedTo(it.id) &&

      (!this.config.maxConnectionDistance || this.isValidConnectionByDistance(it))
    )
  }

  private isValidConnectionByDistance(peer: KnownPeerData) {
    const distance = this.distanceTo(peer.id)
    return typeof distance !== 'undefined' && distance <= this.config.maxConnectionDistance!
  }

  private peerSortCriteria() {
    return (peer1: KnownPeerData, peer2: KnownPeerData) => {
      // We prefer those peers that have position over those that don't
      if (peer1.position && !peer2.position) return -1
      if (peer2.position && !peer1.position) return 1

      if (peer1.position && peer2.position) {
        const distanceDiff = this.distanceTo(peer1.id)! - this.distanceTo(peer2.id)!
        // If the distance is the same, we randomize
        return distanceDiff === 0 ? 0.5 - Math.random() : distanceDiff
      }

      // If none has position or if we don't, we randomize
      return 0.5 - Math.random()
    }
  }

  private calculateNextNetworkOperation(connectionCandidates: KnownPeerData[]): NetworkOperation | undefined {
    logger.log(`Calculating network operation with candidates ${JSON.stringify(connectionCandidates)}`)

    const peerSortCriteria = this.peerSortCriteria()

    const pickCandidates = (count: number) => {
      // We are going to be calculating the distance to each of the candidates. This could be costly, but since the state could have changed after every operation,
      // we need to ensure that the value is updated. If known peers is kept under maybe 2k elements, it should be no problem.
      return pickBy(connectionCandidates, count, peerSortCriteria)
    }

    const neededConnections = DEFAULT_TARGET_CONNECTIONS - this.mesh.connectedCount()

    // If we need to establish new connections because we are below the target, we do that
    if (neededConnections > 0 && connectionCandidates.length > 0) {
      logger.log('Establishing connections to reach target')
      return async () => {
        const [candidates, remaining] = pickCandidates(neededConnections)

        logger.log(`Picked connection candidates ${JSON.stringify(candidates)} `)

        await Promise.all(
          candidates.map((candidate) =>
            this.connectTo(candidate).catch((e) =>
              logger.log(`Error connecting to candidate ${candidate} ${e} `)
            )
          )
        )
        return remaining
      }
    }

    // If we are over the max amount of connections, we discard the "worst"
    const toDisconnect = this.mesh.connectedCount() - DEFAULT_MAX_CONNECTIONS

    if (toDisconnect > 0) {
      logger.log(`Too many connections.Need to disconnect from: ${toDisconnect} `)
      return async () => {
        Object.values(this.knownPeers)
          .filter((peer) => this.isConnectedTo(peer.id))
          // We sort the connected peer by the opposite criteria
          .sort((peer1, peer2) => -peerSortCriteria(peer1, peer2))
          .slice(0, toDisconnect)
          .forEach((peer) => this.disconnectFrom(peer.id))
        return connectionCandidates
      }
    }

    if (connectionCandidates.length > 0) {
      // We find the worst distance of the current connections
      const worstPeer = this.getWorstConnectedPeerByDistance()

      const sortedCandidates = connectionCandidates.sort(peerSortCriteria)
      // We find the best candidate
      const bestCandidate = sortedCandidates.splice(0, 1)[0]

      if (bestCandidate) {
        const bestCandidateDistance = this.distanceTo(bestCandidate.id)

        if (typeof bestCandidateDistance !== 'undefined' && (!worstPeer || bestCandidateDistance < worstPeer[0])) {
          // If the best candidate is better than the worst connection, we connect to that candidate.
          // The next operation should handle the disconnection of the worst
          logger.log(`Found a better candidate for connection: ${bestCandidateDistance} distance: ${bestCandidateDistance} worst: ${worstPeer} `)
          return async () => {
            await this.connectTo(bestCandidate)
            return sortedCandidates
          }
        }
      }
    }

    // We drop those connections too far away
    if (this.config.disconnectDistance) {
      const connectionsToDrop = this.mesh.connectedPeerIds().filter((it) => {
        const distance = this.distanceTo(it)
        // We need to check that we are actually connected to the peer, and also only disconnect to it if we know we are far away and we don't have any rooms in common
        return this.isConnectedTo(it) && distance && distance >= this.config.disconnectDistance!
      })

      if (connectionsToDrop.length > 0) {
        logger.log(`Dropping connections because they are too far away and don't have rooms in common: ${connectionsToDrop}`)
        return async () => {
          connectionsToDrop.forEach((it) => this.disconnectFrom(it))
          return connectionCandidates
        }
      }
    }
  }

  private distanceTo(peerId: string) {
    const position = this.selfPosition()
    if (this.knownPeers[peerId]?.position && position) {
      return this.config.distance(position, this.knownPeers[peerId].position!)
    }
  }

  private getExpireTime(packet: Packet): number {
    return packet.getExpireTime() > 0 ? packet.getExpireTime() : DEFAULT_MESSAGE_EXPIRATION_TIME
  }

  async connectTo(known: KnownPeerData) {
    return await this.mesh.connectTo(known.id)
  }

  private disconnectFrom(peerId: string) {
    this.mesh.disconnectFrom(peerId)
    delete this.peerRelayData[peerId]
  }

  private ensureAndUpdateKnownPeer(packet: Packet, connectedPeerId: string) {
    const minPeerData = { id: packet.getSrc() }
    this.addKnownPeerIfNotExists(minPeerData)

    this.knownPeers[packet.getSrc()].reachableThrough[connectedPeerId] = {
      id: connectedPeerId,
      hops: packet.getHops() + 1,
      timestamp: Date.now()
    }
  }

  private addKnownPeerIfNotExists(peer: MinPeerData) {
    if (!this.knownPeers[peer.id]) {
      this.knownPeers[peer.id] = {
        ...peer,
        subtypeData: {},
        reachableThrough: {}
      }
    }

    return this.knownPeers[peer.id]
  }

  private removeKnownPeer(peerId: string) {
    delete this.knownPeers[peerId]
  }

  private selfPosition(): Position3D | undefined {
    // TODO we also use this for the BFF, maybe receive this as part of the config
    if (lastPlayerPositionReport) {
      const { x, y, z } = lastPlayerPositionReport.position
      return [x, y, z]
    }
  }
}
