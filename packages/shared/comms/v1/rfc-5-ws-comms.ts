import { future, IFuture } from 'fp-future'

import * as rfc5 from '../ws-comms-rfc-5.gen'
import { Stats } from '../debug'
import { Writer } from 'protobufjs/minimal'
import { TransportMessage, IBrokerTransport } from './IBrokerTransport'
import { ILogger, createLogger } from 'shared/logger'
import { Observable } from 'mz-observable'
import { ExplorerIdentity } from 'shared/session/types'
import { wsAsAsyncChannel } from './ws-async-channel'
import { Authenticator } from '@dcl/crypto'

// shared writer to leverage pools
const writer = new Writer()

function craftMessage(packet: Partial<rfc5.WsPacket>): Uint8Array {
  writer.reset()
  rfc5.WsPacket.encode(packet as any, writer)
  return writer.finish()
}

export class Rfc5BrokerConnection implements IBrokerTransport {
  public alias: number | null = null

  public stats: Stats | null = null

  public logger: ILogger = createLogger('Broker: ')

  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()

  private connected = future<void>()
  private peers = new Map<number, string>()

  get connectedPromise(): IFuture<void> {
    return this.connected
  }

  private ws: WebSocket | null = null

  constructor(public url: string, private identity: ExplorerIdentity) {}

  async connect(): Promise<void> {
    if (this.ws) throw new Error('Cannot call connect twice per IBrokerTransport')

    const ws = new WebSocket(this.url, ['rfc5', 'rfc4'])
    const connected = future<void>()
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => connected.resolve()

    ws.onerror = (event) => {
      this.logger.error('socket error', event)
      this.disconnect().catch(this.logger.error)
      connected.reject(event as any)
    }

    ws.onclose = () => {
      this.disconnect()
    }

    const channel = wsAsAsyncChannel(ws)
    try {
      await connected

      {
        // phase 0, identify ourselves
        const identificationMessage = craftMessage({
          peerIdentification: {
            address: this.identity.address
          }
        })
        ws.send(identificationMessage)
      }

      {
        // phase 1, respond to challenge
        const { challengeMessage, welcomeMessage } = await channel.yield(1000, 'Error waiting for remote challenge')

        // only welcomeMessage and challengeMessage are valid options for this phase of the protocol
        if (welcomeMessage) {
          return this.handleWelcomeMessage(welcomeMessage, ws)
        } else if (!challengeMessage) {
          throw new Error('Protocol error: server did not provide a challenge')
        }

        const authChainJson = JSON.stringify(Authenticator.signPayload(this.identity, challengeMessage.challengeToSign))
        ws.send(craftMessage({ signedChallengeForServer: { authChainJson } }))
      }

      {
        // phase 2, we are in
        const { welcomeMessage } = await channel.yield(1000, 'Error waiting for welcome message')
        if (!welcomeMessage) throw new Error('Protocol error: server did not send a welcomeMessage')

        return this.handleWelcomeMessage(welcomeMessage, ws)
      }
    } catch (err: any) {
      this.connected.reject(err)
      // close the WebSocket on error
      if (ws.readyState == ws.OPEN) ws.close()
      // and bubble up the error
      throw err
    } finally {
      channel.close()
    }
  }

  handleWelcomeMessage(welcomeMessage: rfc5.WsWelcome, socket: WebSocket) {
    this.alias = welcomeMessage.alias
    for (const [alias, address] of Object.entries(welcomeMessage.peerIdentities)) {
      this.peers.set(+alias | 0, address)
    }
    this.ws = socket
    this.connected.resolve()
    socket.addEventListener('message', this.onWsMessage.bind(this))
  }

  send(body: Uint8Array, _reliable: boolean) {
    this.internalSend(
      craftMessage({
        peerUpdateMessage: {
          body,
          fromAlias: this.alias || 0
        }
      })
    )
  }

  async disconnect() {
    if (this.ws) {
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
      this.onDisconnectObservable.notifyObservers()
    }
  }

  private async onWsMessage(event: MessageEvent) {
    const data = event.data
    const msg = new Uint8Array(data)
    const packet = rfc5.WsPacket.decode(msg)

    if (packet.peerJoinMessage) {
      this.peers.set(packet.peerJoinMessage.alias, packet.peerJoinMessage.address)
    } else if (packet.peerKicked) {
      // TODO: bubble up disconnection reason to prevent reconnects
      this.disconnect()
    } else if (packet.peerLeaveMessage) {
      const currentPeer = this.peers.get(packet.peerLeaveMessage.alias)
      if (currentPeer) {
        this.peers.delete(packet.peerLeaveMessage.alias)
        // TODO: notify missing avatar
        // this.onMessageObservable.notifyObservers({
        //   senderAddress: currentPeer,
        //   data: craftRfc4Message({ peerDisconnected: {} })
        // })
      }
    } else if (packet.peerUpdateMessage) {
      const currentPeer = this.peers.get(packet.peerUpdateMessage.fromAlias)
      if (currentPeer) {
        this.onMessageObservable.notifyObservers({
          senderAddress: currentPeer,
          data: packet.peerUpdateMessage.body
        })
      } else {
        debugger
      }
    }
  }

  private internalSend(msg: Uint8Array) {
    if (!this.ws) throw new Error('This transport is closed')

    this.connected
      .then(() => {
        if (this.ws) this.ws.send(msg)
      })
      .catch(console.error)
  }
}
