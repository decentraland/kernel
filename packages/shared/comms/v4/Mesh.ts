import { commConfigurations } from 'config'
import { createLogger } from 'shared/logger'
import { BFFConnection, TopicListener } from './BFFConnection'

type Config = {
  packetHandler: (data: Uint8Array, peerId: string) => void
  isKnownPeer(peerId: string): boolean
}

type Connection = {
  instance: RTCPeerConnection
  createTimestamp: number
  dc?: RTCDataChannel
}

const PEER_CONNECT_TIMEOUT = 3500

export class Mesh {
  private debugWebRtcEnabled = true
  private logger = createLogger('CommsV4:P2P:Mesh:')
  private packetHandler: (data: Uint8Array, peerId: string) => void
  private isKnownPeer: (peerId: string) => boolean
  private peerConnections = new Map<string, Connection>()
  private candidatesListener: TopicListener | null = null
  private answerListener: TopicListener | null = null
  private offerListener: TopicListener | null = null
  private encoder = new TextEncoder()
  private decoder = new TextDecoder()

  constructor(private bff: BFFConnection, private peerId: string, { packetHandler, isKnownPeer }: Config) {
    this.packetHandler = packetHandler
    this.isKnownPeer = isKnownPeer
  }

  public async registerSubscriptions() {
    this.candidatesListener = await this.bff.addPeerTopicListener(
      `${this.peerId}.candidate`,
      this.onCandidateMessage.bind(this)
    )
    this.offerListener = await this.bff.addPeerTopicListener(`${this.peerId}.offer`, this.onOfferMessage.bind(this))
    this.answerListener = await this.bff.addPeerTopicListener(`${this.peerId}.answer`, this.onAnswerListener.bind(this))
  }

  public async connectTo(peerId: string): Promise<void> {
    if (this.peerConnections.has(peerId)) {
      return
    }

    this.logger.log(`Connecting to ${peerId}`)

    const instance = this.createConnection(peerId)
    const conn: Connection = { instance, createTimestamp: Date.now() }

    this.debugWebRtc(`Opening dc for ${peerId}`)
    const dc = instance.createDataChannel('data')
    dc.addEventListener('open', () => {
      conn.dc = dc
    })
    dc.addEventListener('message', (event) => {
      this.packetHandler(event.data, peerId)
    })

    const offer = await instance.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    })
    await instance.setLocalDescription(offer)
    this.debugWebRtc(`Set local description for ${peerId}`)
    this.debugWebRtc(`Sending offer to ${peerId}`)
    await this.bff.publishToTopic(`${peerId}.offer`, this.encoder.encode(JSON.stringify(offer)))

    this.peerConnections.set(peerId, conn)
  }

  public connectedCount(): number {
    let count = 0
    this.peerConnections.forEach(({ instance }: Connection) => {
      if (instance.connectionState === 'connected') {
        count++
      }
    })
    return count
  }

  public disconnectFrom(peerId: string): void {
    this.logger.log(`Disconnecting from ${peerId}`)
    const conn = this.peerConnections.get(peerId)
    if (conn) {
      conn.instance.close()
    }

    this.peerConnections.delete(peerId)
  }

  public hasConnectionsFor(peerId: string): boolean {
    return !!this.peerConnections.get(peerId)
  }

  public isConnectedTo(peerId: string): boolean {
    const conn = this.peerConnections.get(peerId)
    if (!conn) {
      return false
    }
    return conn.instance.connectionState === 'connected'
  }

  public connectedPeerIds(): string[] {
    return Array.from(this.peerConnections.keys())
  }

  public fullyConnectedPeerIds(): string[] {
    const peers: string[] = []

    this.peerConnections.forEach(({ instance }: Connection, peerId: string) => {
      if (instance.connectionState === 'connected') {
        peers.push(peerId)
      }
    })

    return peers
  }

  public checkConnectionsSanity(): void {
    this.peerConnections.forEach((conn: Connection, peerId: string) => {
      if (conn.instance.connectionState !== 'connected' && Date.now() - conn.createTimestamp > PEER_CONNECT_TIMEOUT) {
        this.logger.warn(`The connection to ${peerId} is not in a sane state. Discarding it.`)
        this.disconnectFrom(peerId)
      }
    })
  }

  public sendPacketToPeer(peerId: string, data: Uint8Array): void {
    const conn = this.peerConnections.get(peerId)
    if (!conn || !conn.dc) {
      return
    }

    conn.dc.send(data)
  }

  async dispose(): Promise<void> {
    if (this.candidatesListener) {
      this.bff.removePeerTopicListener(this.candidatesListener)
    }

    if (this.answerListener) {
      this.bff.removePeerTopicListener(this.answerListener)
    }

    if (this.offerListener) {
      this.bff.removePeerTopicListener(this.offerListener)
    }

    this.peerConnections.forEach(({ instance }: Connection) => {
      instance.close()
    })

    this.peerConnections.clear()
  }

  private createConnection(peerId: string) {
    const instance = new RTCPeerConnection({
      iceServers: commConfigurations.defaultIceServers
    })

    instance.addEventListener('icecandidate', async (event) => {
      if (event.candidate) {
        try {
          await this.bff.publishToTopic(`${peerId}.candidate`, this.encoder.encode(JSON.stringify(event.candidate)))
        } catch (err: any) {
          this.logger.error(`cannot publish ice candidate: ${err.toString()}`)
        }
      }
    })

    instance.addEventListener('connectionstatechange', () => {
      this.debugWebRtc(`Connection with ${peerId}, status changed: ${instance.connectionState}`)
    })

    instance.addEventListener('iceconnectionstatechange', () => {
      this.debugWebRtc(`Connection with ${peerId}, ice status changed: ${instance.iceConnectionState}`)
    })
    return instance
  }

  private async onCandidateMessage(data: Uint8Array, peerId: string) {
    const conn = this.peerConnections.get(peerId)
    if (!conn) {
      return
    }

    try {
      const candidate = JSON.parse(this.decoder.decode(data))
      await conn.instance.addIceCandidate(candidate)
    } catch (e: any) {
      this.logger.error(`Failed to add ice candidate: ${e.toString()}`)
    }
  }

  private async onOfferMessage(data: Uint8Array, peerId: string) {
    if (!this.isKnownPeer(peerId)) {
      this.logger.log(`Reject offer from unkown peer ${peerId}`)
    }

    this.debugWebRtc(`Got offer message from ${peerId}`)

    if (this.peerConnections.has(peerId)) {
      if (this.peerId < peerId) {
        this.logger.warn(`Both peers try to establish connection with each other ${peerId}, ignoring ofer`)
        return
      }
      this.logger.warn(`Both peers try to establish connection with each other ${peerId}, keeping this offer`)
    }

    const offer = JSON.parse(this.decoder.decode(data))
    const instance = this.createConnection(peerId)
    const conn: Connection = { instance, createTimestamp: Date.now() }
    this.peerConnections.set(peerId, conn)

    instance.addEventListener('datachannel', (event) => {
      this.debugWebRtc(`Got data channel from ${peerId}`)
      const dc = event.channel
      dc.addEventListener('open', () => {
        conn.dc = dc
      })

      dc.addEventListener('message', (event) => {
        this.packetHandler(event.data, peerId)
      })
    })

    try {
      this.debugWebRtc(`Setting remote description for ${peerId}`)
      await instance.setRemoteDescription(offer)

      this.debugWebRtc(`Creating answer for ${peerId}`)
      const answer = await instance.createAnswer()

      this.debugWebRtc(`Setting local description for ${peerId}`)
      await instance.setLocalDescription(answer)

      this.debugWebRtc(`Sending answer to ${peerId}`)
      await this.bff.publishToTopic(`${peerId}.answer`, this.encoder.encode(JSON.stringify(answer)))
    } catch (e: any) {
      this.logger.error(`Failed to create answer: ${e.toString()}`)
    }
  }

  private async onAnswerListener(data: Uint8Array, peerId: string) {
    this.debugWebRtc(`Got answer message from ${peerId}`)
    const conn = this.peerConnections.get(peerId)
    if (!conn) {
      return
    }

    try {
      const answer = JSON.parse(this.decoder.decode(data))
      this.debugWebRtc(`Setting remote description for ${peerId}`)
      await conn.instance.setRemoteDescription(answer)
    } catch (e: any) {
      this.logger.error(`Failed to set remote description: ${e.toString()}`)
    }
  }

  private debugWebRtc(message: string) {
    if (this.debugWebRtcEnabled) {
      this.logger.log(message)
    }
  }
}
