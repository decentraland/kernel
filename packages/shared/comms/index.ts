import { commConfigurations, COMMS, PREFERED_ISLAND } from 'config'
import { CliBrokerConnection } from './v1/CliBrokerConnection'
import { BrokerWorldInstanceConnection } from '../comms/v1/brokerWorldInstanceConnection'
import { RoomConnection } from './interface/index'
import { LighthouseConnectionConfig, LighthouseWorldInstanceConnection } from './v2/LighthouseWorldInstanceConnection'
import { Authenticator, AuthIdentity } from '@dcl/crypto'
import { getCommsServer } from '../dao/selectors'
import { store } from 'shared/store/isolatedStore'
import { getCommsConfig } from 'shared/meta/selectors'
import { ensureMetaConfigurationInitialized } from 'shared/meta/index'
import { getIdentity } from 'shared/session'
import { setCommsIsland } from './actions'
import { MinPeerData } from '@dcl/catalyst-peer'
import { commsLogger, CommsContext } from './context'
import { getCurrentIdentity } from 'shared/session/selectors'
import { getCommsContext } from './selectors'
import { Realm } from 'shared/dao/types'
import { resolveCommsV4Urls, resolveCommsV3Urls } from './v3/resolver'
import { BFFConfig, BFFConnection } from './v3/BFFConnection'
import { InstanceConnection as V3InstanceConnection } from './v3/InstanceConnection'
import { removePeerByUUID, removeMissingPeers } from './peers'
import { lastPlayerPositionReport } from 'shared/world/positionThings'
import { ProfileType } from 'shared/profiles/types'
import { OfflineRoomConnection } from './offline-room-connection'

export type CommsVersion = 'v1' | 'v2' | 'v3' | 'v4' | 'offline'
export type CommsMode = CommsV1Mode | CommsV2Mode
export type CommsV1Mode = 'local' | 'remote'
export type CommsV2Mode = 'p2p' | 'server'

export function sendPublicChatMessage(messageId: string, text: string) {
  const commsContext = getCommsContext(store.getState())

  if (commsContext && commsContext.currentPosition) {
    commsContext.worldInstanceConnection
      .sendChatMessage(commsContext.currentPosition, messageId, text)
      .catch((e) => commsLogger.warn(`error while sending message `, e))
  }
}

export function sendParcelSceneCommsMessage(cid: string, message: string) {
  const commsContext = getCommsContext(store.getState())

  if (commsContext && commsContext.currentPosition) {
    commsContext.worldInstanceConnection
      .sendParcelSceneCommsMessage(cid, message)
      .catch((e) => commsLogger.warn(`error while sending message `, e))
  }
}

export async function connectComms(realm: Realm): Promise<CommsContext | null> {
  commsLogger.log('Connecting to realm', realm)

  if (!realm) {
    debugger
    throw new Error('No realm was found')
  }

  const identity = getCurrentIdentity(store.getState())

  if (!identity) {
    throw new Error("Can't connect to comms because there is no identity")
  }

  let connection: RoomConnection

  const DEFAULT_PROTOCOL = 'v2'
  const protocol = realm.protocol ?? DEFAULT_PROTOCOL

  switch (protocol) {
    case 'v1': {
      let location = document.location.toString()
      if (location.indexOf('#') > -1) {
        location = location.substring(0, location.indexOf('#')) // drop fragment identifier
      }
      const commsUrl = location.replace(/^http/, 'ws') // change protocol to ws

      const url = new URL(commsUrl)
      const qs = new URLSearchParams({
        identity: btoa(identity.address)
      })
      url.search = qs.toString()

      commsLogger.log('Using WebSocket comms: ' + url.href)

      connection = new BrokerWorldInstanceConnection(new CliBrokerConnection(url.href))
      break
    }
    case 'v2': {
      await ensureMetaConfigurationInitialized()

      const lighthouseUrl = getCommsServer(realm.hostname)
      const commsConfig = getCommsConfig(store.getState())

      const peerConfig: LighthouseConnectionConfig = {
        connectionConfig: {
          iceServers: commConfigurations.defaultIceServers
        },
        authHandler: async (msg: string) => {
          try {
            return Authenticator.signPayload(getIdentity() as AuthIdentity, msg)
          } catch (e) {
            commsLogger.info(`error while trying to sign message from lighthouse '${msg}'`)
          }
          // if any error occurs
          return getIdentity()
        },
        logLevel: 'NONE',
        targetConnections: commsConfig.targetConnections ?? 4,
        maxConnections: commsConfig.maxConnections ?? 6,
        positionConfig: {
          selfPosition: () => {
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
          onIslandChange: (island: string | undefined, peers: MinPeerData[]) => {
            store.dispatch(setCommsIsland(island))
            removeMissingPeers(peers)
          },
          onPeerLeftIsland: (peerId: string) => {
            commsLogger.info('Removing peer that left an island', peerId)
            removePeerByUUID(peerId)
          }
        },
        preferedIslandId: PREFERED_ISLAND ?? ''
      }

      if (!commsConfig.relaySuspensionDisabled) {
        peerConfig.relaySuspensionConfig = {
          relaySuspensionInterval: commsConfig.relaySuspensionInterval ?? 750,
          relaySuspensionDuration: commsConfig.relaySuspensionDuration ?? 5000
        }
      }

      commsLogger.log('Using Remote lighthouse service: ', lighthouseUrl)

      connection = new LighthouseWorldInstanceConnection(lighthouseUrl, peerConfig, (status) => {
        commsLogger.log('Lighthouse status: ', status)
        switch (status.status) {
          case 'realm-full':
          case 'reconnection-error':
          case 'id-taken':
            connection.disconnect().catch(commsLogger.error)
            break
        }
      })

      break
    }
    case 'v3': {
      await ensureMetaConfigurationInitialized()

      const { wsUrl } = resolveCommsV3Urls(realm)!
      const bffConfig: BFFConfig = {
        getIdentity: () => getIdentity() as AuthIdentity
      }

      commsLogger.log('Using BFF service: ', wsUrl)
      const bff = new BFFConnection(wsUrl, bffConfig)
      connection = new V3InstanceConnection(bff, {
        onPeerLeft: (peerId: string) => {
          commsLogger.info('Removing peer that left an island', peerId)
          removePeerByUUID(peerId)
        }
      })
      break
    }
    case 'v4': {
      const { wsUrl } = resolveCommsV4Urls(realm)!

      const url = new URL(wsUrl)
      const qs = new URLSearchParams({
        identity: btoa(identity.address)
      })
      url.search = qs.toString()
      const finalUrl = url.toString()
      commsLogger.log('Using WebSocket comms: ' + finalUrl)
      const commsBroker = new CliBrokerConnection(finalUrl)
      connection = new BrokerWorldInstanceConnection(commsBroker)

      break
    }
    case 'offline': {
      connection = new OfflineRoomConnection()

      break
    }
    default: {
      throw new Error(`unrecognized comms mode "${COMMS}" "${protocol}"`)
    }
  }

  const commsContext = new CommsContext(
    realm,
    identity.address,
    identity.hasConnectedWeb3 ? ProfileType.DEPLOYED : ProfileType.LOCAL,
    connection
  )

  if (await commsContext.connect()) {
    return commsContext
  } else {
    return null
  }
}
