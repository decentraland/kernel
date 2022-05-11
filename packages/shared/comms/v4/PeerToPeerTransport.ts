import { store } from 'shared/store/isolatedStore'
import { getCommsConfig } from 'shared/meta/selectors'
import { commConfigurations } from 'config'
import { Message } from 'google-protobuf'
import { Transport, TransportMessage } from './Transport'
import { Observable } from 'mz-observable'
import { lastPlayerPositionReport } from 'shared/world/positionThings'
import { Authenticator, AuthIdentity } from 'dcl-crypto'
import { getIdentity } from 'shared/session'

import { removePeerByUUID } from '../peers'
import {
  Peer,
  PeerConfig,
  PacketCallback,
  PeerStatus,
  PeerMessageTypes
} from '@dcl/catalyst-peer'

import { createLogger } from 'shared/logger'

const logger = createLogger('CommsV4:Peer2Peer: ')

export class PeerToPeerTransport implements Transport {
  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()

  private peer: Peer

  private rooms: string[] = []
  private disposed = false

  constructor(
    private lighthouseUrl: string,
    private islandId: string
  ) {
    const commsConfig = getCommsConfig(store.getState())

    const peerConfig: PeerConfig = {
      connectionConfig: {
        iceServers: commConfigurations.defaultIceServers
      },
      authHandler: async (msg: string) => {
        try {
          return Authenticator.signPayload(getIdentity() as AuthIdentity, msg)
        } catch (e) {
          logger.info(`error while trying to sign message from lighthouse '${msg}'`)
        }
        // if any error occurs
        return getIdentity()
      },
      logLevel: 'INFO',
      targetConnections: commsConfig.targetConnections ?? 4,
      maxConnections: commsConfig.maxConnections ?? 6,
      positionConfig: {
        selfPosition: () => { // TODO we also use this for the BFF, maybe receive this as part of the config
          if (lastPlayerPositionReport) {
            const { x, y, z } = lastPlayerPositionReport.position
            return [x, y, z]
          }
        },
        maxConnectionDistance: 4,
        nearbyPeersDistance: 5,
        disconnectDistance: 5
      },
      eventsHandler: {
        statusHandler: (status: PeerStatus) => {
          logger.log('Lighthouse status: ', status)
          switch (status) {
            case 'reconnection-error':
            case 'id-taken':
              this.disconnect().catch(logger.error)
              break
          }
        },
        onPeerLeftIsland: (peerId: string) => {
          logger.info('Removing peer that left an island', peerId)
          removePeerByUUID(peerId)
        }
      }
    }

    if (!commsConfig.relaySuspensionDisabled) {
      peerConfig.relaySuspensionConfig = {
        relaySuspensionInterval: commsConfig.relaySuspensionInterval ?? 750,
        relaySuspensionDuration: commsConfig.relaySuspensionDuration ?? 5000
      }
    }

    this.peer = new Peer(this.lighthouseUrl, undefined, this.peerCallback, peerConfig)

    globalThis.__DEBUG_PEER = this.peer
  }

  async connect() {
    try {
      if (!this.peer.connectedCount()) {
        await this.peer.awaitConnectionEstablished(60000)
      }
      logger.log('Lighthouse status: connected')

      this.rooms = [this.islandId]

      await this.syncRoomsWithPeer()
    } catch (e: any) {
      logger.error('Error while connecting to layer', e)
      logger.log(`Lighthouse status: ${e.responseJson && e.responseJson.status === 'layer_is_full' ? 'realm-full' : 'error'}`)
      await this.disconnect()
    }
  }

  async disconnect() {
    if (this.disposed) return

    this.disposed = true
    await this.peer.dispose()
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
      await this.peer.sendMessage(this.islandId, msg.serializeBinary(), t)
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

  private peerCallback: PacketCallback = (sender, room, payload, _packet) => {
    if (this.disposed) return

    this.onMessageObservable.notifyObservers({
      peer: sender,
      data: payload
    })

  }
}
