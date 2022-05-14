import { commConfigurations } from 'config'
import { createLogger } from 'shared/logger'
import { BFFConnection, TopicListener } from './BFFConnection'

type Config = {
  packetHandler: (data: Uint8Array, peerId: string) => void
}

type Connection = {
  instance: RTCPeerConnection
  start: number
  dc?: RTCDataChannel
}

export class Mesh {
  private logger = createLogger('CommsV4:P2P:Mesh:')
  private packetHandler: (data: Uint8Array, peerId: string) => void
  private peerConnections = new Map<string, Connection>()
  private candidatesListener: TopicListener
  private answerListener: TopicListener
  private offerListener: TopicListener
  private encoder = new TextEncoder()
  private decoder = new TextDecoder()

  constructor(private bff: BFFConnection, peerId: string, { packetHandler }: Config) {
    this.packetHandler = packetHandler

    this.candidatesListener = this.bff.addListener(`peer.${peerId}.candidate`, this.onCandidateMessage.bind(this))

    this.offerListener = this.bff.addListener(`peer.${peerId}.offer`, async (data: Uint8Array, peerId?: string) => {
      if (!peerId) {
        return
      }
      //TODO check if it's a known peer

      this.logger.log(`Got offer message from ${peerId}`)

      if (this.peerConnections.has(peerId)) {
        // TODO maybe we can do something smart about this
        this.logger.error(`Both peers try to establish connection with each other ${peerId}`)
        return
      }

      const offer = JSON.parse(this.decoder.decode(data))
      const instance = this.createConnection(peerId)
      const conn: Connection = { instance, start: Date.now() }
      this.peerConnections.set(peerId, conn)

      instance.addEventListener('datachannel', event => {
        this.logger.log(`Got data channel from ${peerId}`)
        const dc = event.channel
        dc.addEventListener('open', () => {
          conn.dc = dc
        })

        dc.addEventListener('message', (event) => {
          this.packetHandler(event.data, peerId)
        });
      });

      try {
        this.logger.log(`Setting remote description for ${peerId}`)
        await instance.setRemoteDescription(offer)

        this.logger.log(`Creating answer for ${peerId}`)
        const answer = await instance.createAnswer()

        this.logger.log(`Setting local description for ${peerId}`)
        await instance.setLocalDescription(answer)

        this.logger.log(`Sending answer to ${peerId}`)
        this.bff.sendMessage(`peer.${peerId}.answer`, this.encoder.encode(JSON.stringify(answer)))
      } catch (e: any) {
        this.logger.error(`Failed to create answer: ${e.toString()}`);
        throw e
      }
    })

    this.answerListener = this.bff.addListener(`peer.${peerId}.answer`, async (data: Uint8Array, peerId?: string) => {
      this.logger.log(`Got answer message from ${peerId}`)
      const conn = peerId && this.peerConnections.get(peerId)
      if (!conn) {
        return
      }

      const answer = JSON.parse(this.decoder.decode(data))
      this.logger.log(`Setting remote description for ${peerId}`)
      await conn.instance.setRemoteDescription(answer)
    })

    this.bff.refreshTopics()
  }


  public async connectTo(peerId: string): Promise<void> {
    if (this.peerConnections.has(peerId)) {
      return
    }

    this.logger.log(`Connecting to ${peerId}`)

    const instance = this.createConnection(peerId)
    const conn: Connection = { instance, start: Date.now() }

    this.logger.log(`Opening dc for ${peerId}`)
    const dc = instance.createDataChannel('data');
    dc.addEventListener('open', () => {
      conn.dc = dc
    })
    dc.addEventListener('message', (event) => {
      this.packetHandler(event.data, peerId)
    });

    const offer = await instance.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    })
    await instance.setLocalDescription(offer);
    this.logger.log(`Set local description for ${peerId}`)
    this.logger.log(`Sending offer to ${peerId}`)
    this.bff.sendMessage(`peer.${peerId}.offer`, this.encoder.encode(JSON.stringify(offer)))

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
    // TODO
  }

  public sendPacketToPeer(peerId: string, data: Uint8Array): void {
    const conn = this.peerConnections.get(peerId)
    if (!conn || !conn.dc) {
      return
    }

    conn.dc.send(data)
  }

  async dispose(): Promise<void> {
    this.bff.removeListener(this.candidatesListener)
    this.bff.removeListener(this.answerListener)
    this.bff.removeListener(this.offerListener)

    this.peerConnections.forEach(({ instance }: Connection) => {
      instance.close()
    })

    this.peerConnections.clear()
  }

  private createConnection(peerId: string) {
    const instance = new RTCPeerConnection({
      iceServers: commConfigurations.defaultIceServers
    })

    instance.addEventListener('icecandidate', event => {
      if (event.candidate) {
        this.bff.sendMessage(`peer.${peerId}.candidate`, this.encoder.encode(JSON.stringify(event.candidate)))
      }
    })

    instance.addEventListener('connectionstatechange', () => {
      this.logger.log(`Connection with ${peerId}, status changed: ${instance.connectionState}`)
    });

    instance.addEventListener('iceconnectionstatechange', (event) => {
      this.logger.log(`Connection with ${peerId}, ice status changed: ${instance.iceConnectionState}`)
      console.log(event)
    });
    return instance
  }

  private onCandidateMessage(data: Uint8Array, peerId?: string) {
    const conn = peerId && this.peerConnections.get(peerId)
    if (!conn) {
      return
    }

    const candidate = JSON.parse(this.decoder.decode(data))
    conn.instance.addIceCandidate(candidate)
  }

}
