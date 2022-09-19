import { Emitter } from 'mitt'
import * as rfc4 from '../comms-rfc-4.gen'
import { CommsEvents } from '../interface'
import { MORDOR_POSITION_RFC4 } from '../const'

export type CachedPeer = {
  address?: string
  position?: rfc4.Position
  profileResponse?: rfc4.ProfileResponse
  profileAnnounce?: rfc4.AnnounceProfileVersion
}

// This component abstracts the opaque peerId from transports into something that
// works for RFC4
export function peerIdHandler(options: { events: Emitter<CommsEvents> }) {
  const peers = new Map<string, CachedPeer>()

  function getPeer(sender: string): CachedPeer {
    if (!peers.has(sender)) {
      peers.set(sender, {})
    }
    return peers.get(sender)!
  }

  function disconnectPeer(id: string) {
    const peer = getPeer(id)
    console.log('Disconnecting peer', id)
    if (peer.address) {
      // TODO: we need better removal events
      options.events.emit('position', { address: peer.address, data: MORDOR_POSITION_RFC4, time: new Date().getTime() })
    }
  }

  return {
    disconnectPeer,
    removeAllBut(peerIds: string[]) {
      for (const [id] of peers) {
        if (!peerIds.includes(id)) {
          disconnectPeer(id)
        }
      }
    },
    identifyPeer(id: string, address: string) {
      const peer = getPeer(id)

      if (peer.address && peer.address != address) {
        disconnectPeer(id)
        peer.position = undefined
        peer.profileAnnounce = undefined
        peer.profileResponse = undefined
        peer.address = undefined
      }

      if (!peer.address) {
        console.log('Recognized peer', id)
        peer.address = address
        if (peer.position) {
          options.events.emit('position', { address, data: peer.position, time: new Date().getTime() })
        }
        if (peer.profileResponse) {
          options.events.emit('profileResponse', { address, data: peer.profileResponse, time: new Date().getTime() })
        }
        if (peer.profileAnnounce) {
          options.events.emit('profileMessage', { address, data: peer.profileAnnounce, time: new Date().getTime() })
        }
      }
    },
    handleMessage<T extends keyof CommsEvents>(message: T, packet: CommsEvents[T]) {
      const peer = getPeer(packet.address)

      if (peer.address) {
        options.events.emit(message, { ...packet, address: peer.address })
      }

      if (message == 'position') {
        const p = packet.data as rfc4.Position
        if (!peer.position || p.index >= peer.position.index) peer.position = p
      } else if (message == 'profileResponse') {
        const p = packet.data as rfc4.ProfileResponse
        if (!peer.profileResponse) peer.profileResponse = p
      } else if (message == 'profileMessage') {
        const p = packet.data as rfc4.AnnounceProfileVersion
        if (!peer.profileAnnounce || peer.profileAnnounce.profileVersion < p.profileVersion) peer.profileAnnounce = p
      }
    }
  }
}
