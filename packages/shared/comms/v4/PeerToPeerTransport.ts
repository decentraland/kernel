import { store } from 'shared/store/isolatedStore'
import { future, IFuture } from 'fp-future'
import { getCommsConfig } from 'shared/meta/selectors'
import { Message } from 'google-protobuf'
import { Transport, TransportMessage } from './Transport'
import { Observable } from 'mz-observable'
import { lastPlayerPositionReport } from 'shared/world/positionThings'
// import { Authenticator, AuthIdentity } from 'dcl-crypto'
// import { getIdentity } from 'shared/session'

import { JoinIslandMessage, LeftIslandMessage } from './proto/archipelago_pb'

import { Reader } from 'protobufjs/minimal'
import { Mesh } from './Mesh'

import { removePeerByUUID } from '../peers'
import {
  PongData,
  PingData,
  MessageData,
  PeerMessageType,
  PongMessageType,
  PayloadEncoding,
  PingMessageType,
  PeerMessageTypes,
  Position3D,
  MinPeerData,
  PeerRelayData,
  KnownPeerData,
  // PeerWebRTCHandler,
  discretizedPositionDistanceXZ,
  Packet,
  SuspendRelayData,
  SuspendRelayType,
  PingResult
} from '@dcl/catalyst-peer'

import { createLogger } from 'shared/logger'
import { BFFConnection, TopicListener } from './BFFConnection'

const logger = createLogger('CommsV4:P2P: ')

export const MAX_UINT32 = 4294967295
export function randomUint32(): number {
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

type NetworkOperation = () => Promise<KnownPeerData[]>

type PacketData =
  | { messageData: MessageData }
  | { pingData: PingData }
  | { pongData: PongData }
  | { suspendRelayData: SuspendRelayData }

type ActivePing = {
  results: PingResult[]
  startTime?: number
  future: IFuture<PingResult[]>
}

export const CONSTANTS = {
  EXPIRATION_LOOP_INTERVAL: 2000,
  KNOWN_PEERS_EXPIRE_TIME: 90000,
  KNOWN_PEER_RELAY_EXPIRE_TIME: 30000,
  OVERCONNECTED_NETWORK_UPDATE_DELAY: 500,
  UPDATE_NETWORK_INTERVAL: 30000,
  DEFAULT_TTL: 10,
  DEFAULT_PING_TIMEOUT: 7000,
  OLD_POSITION_THRESHOLD: 30000,
  DEFAULT_STATS_UPDATE_INTERVAL: 1000,
  DEFAULT_TARGET_CONNECTIONS: 4,
  DEFAULT_MAX_CONNECTIONS: 6,
  DEFAULT_PEER_CONNECT_TIMEOUT: 3500,
  DEFAULT_MESSAGE_EXPIRATION_TIME: 10000,
  // DEFAULT_RECONNECTIONS_ATTEMPTS: 10,
  // DEFAULT_RECONNECTION_BACKOFF_MS: 2000,
  DEFAULT_HEARTBEAT_INTERVAL: 2000
}

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

export class PeerToPeerTransport implements Transport {
  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()

  // private wrtcHandler: PeerWebRTCHandler
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
    const commsConfig = getCommsConfig(store.getState())
    this.config = {
      maxConnectionDistance: 4,
      nearbyPeersDistance: 5,
      disconnectDistance: 5,
      distance: discretizedPositionDistanceXZ()
    }
    // relaySuspensionDisabled: RelaySuspensionConfig
    if (!commsConfig.relaySuspensionDisabled) {
      this.config.relaySuspensionConfig = {
        relaySuspensionInterval: commsConfig.relaySuspensionInterval ?? 750,
        relaySuspensionDuration: commsConfig.relaySuspensionDuration ?? 5000
      }
    }

    this.instanceId = randomUint32()

    this.mesh = new Mesh(this.bffConnection, this.peerId, {
      packetHandler: this.handlePeerPacket.bind(this)
    })
    // this.wrtcHandler = new PeerWebRTCHandler({
    //   peerId: this.peerId,
    //   // wrtc: this.config.wrtc,
    //   // socketBuilder: this.config.socketBuilder,
    //   authHandler: async (msg: string) => {
    //     try {
    //       return Authenticator.signPayload(getIdentity() as AuthIdentity, msg)
    //     } catch (e) {
    //       logger.info(`error while trying to sign message from lighthouse '${msg}'`)
    //     }
    //     // if any error occurs
    //     return getIdentity()
    //   },
    //   // isReadyToEmitSignals: () => !!this.IslandId,
    //   handshakePayloadExtras: () => ({
    //     protocolVersion: 5,
    //     lighthouseUrl: this.lighthouseUrl,
    //     islandId: this.IslandId,
    //     position: this.selfPosition()
    //   }),
    //   // connectionToken: this.config.token,
    //   rtcConnectionConfig: {
    //     iceServers: commConfigurations.defaultIceServers
    //   },
    //   // serverMessageHandler: this.handleServerMessage.bind(this),
    //   packetHandler: this.handlePeerPacket.bind(this),
    //   // handshakeValidator: this.validateHandshake.bind(this),
    //   // oldConnectionsTimeout: this.config.oldConnectionsTimeout,
    //   // peerConnectTimeout: this.config.peerConnectTimeout,
    //   // receivedOfferValidator: this.validateReceivedOffer.bind(this),
    //   // heartbeatInterval: this.config.heartbeatInterval
    // })
    // this.wrtcHandler.setPeerServerUrl(lighthouseUrl)

    // this.wrtcHandler.on(PeerWebRTCEvent.ConnectionRequestRejected, this.handleConnectionRequestRejected.bind(this))

    // this.wrtcHandler.on(PeerWebRTCEvent.PeerConnectionLost, this.handlePeerConnectionLost.bind(this))

    // this.wrtcHandler.on(PeerWebRTCEvent.PeerConnectionEstablished, this.handlePeerConnectionEstablished.bind(this))

    // this.wrtcHandler.on(PeerWebRTCEvent.ServerConnectionError, async (err) => {
    //   if (err.type === PeerErrorType.UnavailableID) {
    //     this.config.eventsHandler.statusHandler?.('id-taken')
    //   } else {
    //     if (!this.retryingConnection) await this.retryConnection()
    //   }
    // })

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
      }, CONSTANTS.EXPIRATION_LOOP_INTERVAL)

    const scheduleUpdateNetwork = () =>
      setTimeout(() => {
        this.triggerUpdateNetwork('scheduled network update')
        this.updateNetworkTimeoutId = scheduleUpdateNetwork()
      }, CONSTANTS.UPDATE_NETWORK_INTERVAL)

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


    // this.bff.sendTopicMessage(`peer.${peerId}.got_candidate`)

    globalThis.__DEBUG_PEER = this
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

      // TODO: do we have the positions as well?
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
    try {
      // if (!this.connectedCount()) {
      //   await this.wrtcHandler.awaitConnectionEstablished(60000)
      // }

      logger.log('Lighthouse status: connected')

      // this.knownPeers = {}

      //We don't need to remove existing peers since they will eventually expire

      // disconnect from unknown peers
      // for (const peerId of this.wrtcHandler.connectedPeerIds()) {
      //   if (!(peerId in this.knownPeers)) {
      //     this.wrtcHandler.disconnectFrom(peerId)
      //   }
      // }
      this.triggerUpdateNetwork(`changed to island ${this.islandId}`)
    } catch (e: any) {
      logger.error('Error while connecting to layer', e)
      logger.log(`Lighthouse status: ${e.responseJson && e.responseJson.status === 'layer_is_full' ? 'realm-full' : 'error'}`)
      await this.disconnect()
    }
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

  async sendIdentity(msg: Message, reliable: boolean): Promise<void> {
    return this.send(msg, reliable)
  }

  async send(msg: Message, reliable: boolean): Promise<void> {
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
      const packet = Packet.decode(Reader.create(data))


      const packetKey = `${packet.src}_${packet.instanceId}_${packet.sequenceId}`
      const alreadyReceived = !!this.receivedPackets[packetKey]

      this.ensureAndUpdateKnownPeer(packet, peerId)

      if (packet.discardOlderThan !== 0) {
        // If discardOlderThan is zero, then we don't need to store the package.
        // Same or older packages will be instantly discarded
        this.receivedPackets[packetKey] = {
          timestamp: Date.now(),
          expirationTime: this.getExpireTime(packet)
        }
      }

      const expired = this.checkExpired(packet)

      if (packet.hops >= 1) {
        this.countRelay(peerId, packet, expired, alreadyReceived)
      }

      if (!alreadyReceived && !expired) {
        this.processPacket(packet)
      } else {
        this.requestRelaySuspension(packet, peerId)
      }
    } catch (e) {
      logger.warn(`Failed to process message from: ${peerId} ${e}`)
      return
    }
  }

  private processPacket(packet: Packet) {
    this.updateTimeStamp(packet.src, packet.subtype, packet.timestamp, packet.sequenceId)

    packet.hops += 1

    this.knownPeers[packet.src].hops = packet.hops

    if (packet.hops < packet.ttl) {
      this.sendPacket(packet)
    }

    const messageData = packet.messageData
    if (messageData && messageData.room === this.islandId) {
      this.onMessageObservable.notifyObservers({
        peer: packet.src,
        data: this.decodePayload(messageData.payload, messageData.encoding)
      })
    }

    const pingData = packet.pingData
    if (pingData) {
      this.respondPing(pingData.pingId)
    }

    const pongData = packet.pongData
    if (pongData) {
      this.processPong(packet.src, pongData.pingId)
    }

    const suspendRelayData = packet.suspendRelayData
    if (suspendRelayData) {
      this.processSuspensionRequest(packet.src, suspendRelayData)
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
      if (lastUpdate && currentTimestamp - lastUpdate > CONSTANTS.KNOWN_PEERS_EXPIRE_TIME) {
        if (this.isConnectedTo(id)) {
          this.disconnectFrom(id)
        }
        delete this.knownPeers[id]
      } else {
        // We expire reachable through data
        Object.keys(this.knownPeers[id].reachableThrough).forEach((relayId) => {
          if (
            currentTimestamp - this.knownPeers[id].reachableThrough[relayId].timestamp >
            CONSTANTS.KNOWN_PEER_RELAY_EXPIRE_TIME
          ) {
            delete this.knownPeers[id].reachableThrough[relayId]
          }
        })
      }
    })
  }

  private connectedCount() {
    return this.mesh.connectedCount()
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
      suspendRelayData.relayedPeers.forEach(
        (it) => (relayData.ownSuspendedRelays[it] = Date.now() + suspendRelayData.durationMillis)
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
        const suspendRelayData: SuspendRelayData = {
          relayedPeers: relayData.pendingSuspensionRequests,
          durationMillis: suspensionConfig.relaySuspensionDuration
        }

        logger.log(`Requesting relay suspension to ${peerId} ${suspendRelayData}`)

        const packet = this.buildPacketWithData(SuspendRelayType, {
          suspendRelayData
        })

        this.sendPacketToPeer(peerId, packet)

        suspendRelayData.relayedPeers.forEach((relayedPeerId) => {
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
    if (relayData.pendingSuspensionRequests.includes(packet.src)) {
      // If there is already a pending suspension for this src through this connection, we don't do anything
      return
    }

    logger.log(`Consolidating suspension for ${packet.src}->${connectedPeerId}`)

    const now = Date.now()

    // We get a list of through which connected peers is this src reachable and are not suspended
    const reachableThrough = Object.values(this.knownPeers[packet.src].reachableThrough).filter(
      (it) =>
        this.isConnectedTo(it.id) &&
        now - it.timestamp < CONSTANTS.KNOWN_PEER_RELAY_EXPIRE_TIME &&
        !this.isRelayFromConnectionSuspended(it.id, packet.src, now)
    )

    logger.log(`${packet.src} is reachable through ${reachableThrough}`)

    // We only suspend if we will have at least 1 path of connection for this peer after suspensions
    if (reachableThrough.length > 1 || (reachableThrough.length === 1 && reachableThrough[0].id !== connectedPeerId)) {
      logger.log(`Will add suspension for ${packet.src} -> ${connectedPeerId}`)
      relayData.pendingSuspensionRequests.push(packet.src)
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
    let receivedRelayData = relayData.receivedRelayData[packet.src]
    if (!receivedRelayData) {
      receivedRelayData = relayData.receivedRelayData[packet.src] = {
        hops: packet.hops,
        discarded: 0,
        total: 0
      }
    } else {
      receivedRelayData.hops = packet.hops
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
    const pongData: PongData = { pingId }

    // TODO: Maybe we should add a destination and handle this message as unicast
    this.sendPacketWithData({ pongData }, PongMessageType, {
      expireTime: CONSTANTS.DEFAULT_PING_TIMEOUT
    })
  }

  private decodePayload(payload: Uint8Array, encoding: number): any {
    switch (encoding) {
      case PayloadEncoding.BYTES:
        return payload as Uint8Array
      case PayloadEncoding.STRING:
        return new TextDecoder('utf-8').decode(payload)
      case PayloadEncoding.JSON:
        return JSON.parse(new TextDecoder('utf-8').decode(payload))
    }
  }

  private checkExpired(packet: Packet) {
    const discardedByOlderThan: boolean = this.isDiscardedByOlderThanReceivedPackages(packet)

    let discardedByExpireTime: boolean = false
    const expireTime = this.getExpireTime(packet)

    if (this.knownPeers[packet.src].timestamp) {
      discardedByExpireTime = this.knownPeers[packet.src].timestamp! - packet.timestamp > expireTime
    }

    return discardedByOlderThan || discardedByExpireTime
  }

  private isDiscardedByOlderThanReceivedPackages(packet: Packet) {
    if (packet.discardOlderThan >= 0 && packet.subtype) {
      const subtypeData = this.knownPeers[packet.src]?.subtypeData[packet.subtype]
      return (
        subtypeData &&
        subtypeData.lastTimestamp - packet.timestamp > packet.discardOlderThan &&
        subtypeData.lastSequenceId >= packet.sequenceId
      )
    }

    return false
  }


  private generateMessageId() {
    this.currentMessageId += 1
    return this.currentMessageId
  }

  private getEncodedPayload(payload: any): [PayloadEncoding, Uint8Array] {
    if (payload instanceof Uint8Array) {
      return [PayloadEncoding.BYTES, payload]
    } else if (typeof payload === 'string') {
      return [PayloadEncoding.STRING, new TextEncoder().encode(payload)]
    } else {
      return [PayloadEncoding.JSON, new TextEncoder().encode(JSON.stringify(payload))]
    }
  }

  sendMessage(roomId: string, payload: any, type: PeerMessageType) {
    if (roomId !== this.islandId) {
      return Promise.reject(new Error(`cannot send a message in a room not joined(${roomId})`))
    }

    const [encoding, encodedPayload] = this.getEncodedPayload(payload)

    const messageData: MessageData = {
      room: roomId,
      encoding,
      payload: encodedPayload,
      dst: []
    }

    return this.sendPacketWithData({ messageData }, type)
  }

  private sendPacketWithData(data: PacketData, type: PeerMessageType, packetProperties: Partial<Packet> = {}) {
    const packet: Packet = this.buildPacketWithData(type, data, packetProperties)

    this.sendPacket(packet)

    return Promise.resolve()
  }

  private buildPacketWithData(type: PeerMessageType, data: PacketData, packetProperties: Partial<Packet> = {}) {
    const sequenceId = this.generateMessageId()

    const ttl = typeof type.ttl !== 'undefined' ? typeof type.ttl === 'number' ? type.ttl : type.ttl(sequenceId, type) : CONSTANTS.DEFAULT_TTL
    const optimistic = typeof type.optimistic === 'boolean' ? type.optimistic : type.optimistic(sequenceId, type)

    const packet: Packet = {
      sequenceId,
      instanceId: this.instanceId,
      subtype: type.name,
      expireTime: type.expirationTime ?? -1,
      discardOlderThan: type.discardOlderThan ?? -1,
      timestamp: Date.now(),
      src: this.peerId,
      hops: 0,
      ttl,
      receivedBy: [],
      optimistic,
      pingData: undefined,
      pongData: undefined,
      suspendRelayData: undefined,
      messageData: undefined,
      ...data,
      ...packetProperties
    }
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

      await this.sendPacketWithData({ pingData: { pingId } }, PingMessageType, {
        expireTime: CONSTANTS.DEFAULT_PING_TIMEOUT
      })

      setTimeout(() => {
        const activePing = this.activePings[pingId]
        if (activePing) {
          activePing.future.resolve(activePing.results)
          delete this.activePings[pingId]
        }
      }, CONSTANTS.DEFAULT_PING_TIMEOUT)

      return await pingFuture
    }
  }


  private sendPacket(packet: Packet) {
    if (!packet.receivedBy.includes(this.peerId))
      packet.receivedBy.push(this.peerId)


    const peersToSend = this.mesh.fullyConnectedPeerIds().filter(
      (it) =>
        !packet.receivedBy.includes(it) && (packet.hops === 0 || !this.isRelayToConnectionSuspended(it, packet.src))
    )

    if (packet.optimistic) {
      packet.receivedBy = [...packet.receivedBy, ...peersToSend]
    }

    // This is a little specific also, but is here in order to make the measurement as accurate as possible
    if (packet.pingData && packet.src === this.peerId) {
      const activePing = this.activePings[packet.pingData.pingId]
      if (activePing) {
        activePing.startTime = performance.now()
      }
    }

    peersToSend.forEach((peer) => this.sendPacketToPeer(peer, packet))
  }

  private sendPacketToPeer(peer: string, packet: Packet) {
    if (this.isConnectedTo(peer)) {
      try {
        const data = Packet.encode(packet).finish()
        this.mesh.sendPacketToPeer(peer, data)
      } catch (e) {
        logger.warn('Error sending data to peer ${peer} ${e}')
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

    const neededConnections = CONSTANTS.DEFAULT_TARGET_CONNECTIONS - this.connectedCount()

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
    const toDisconnect = this.connectedCount() - CONSTANTS.DEFAULT_MAX_CONNECTIONS

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
    return packet.expireTime > 0 ? packet.expireTime : CONSTANTS.DEFAULT_MESSAGE_EXPIRATION_TIME
  }

  async connectTo(known: KnownPeerData) {
    return await this.mesh.connectTo(known.id)
  }

  private disconnectFrom(peerId: string) {
    this.mesh.disconnectFrom(peerId)
    delete this.peerRelayData[peerId]
  }

  private ensureAndUpdateKnownPeer(packet: Packet, connectedPeerId: string) {
    const minPeerData = { id: packet.src }
    this.addKnownPeerIfNotExists(minPeerData)

    this.knownPeers[packet.src].reachableThrough[connectedPeerId] = {
      id: connectedPeerId,
      hops: packet.hops + 1,
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
