import { commConfigurations, COMMS, DEBUG_COMMS, PREFERED_ISLAND } from 'config'
import { Rfc5BrokerConnection } from './logic/rfc-5-ws-comms'
import { Rfc4RoomConnection } from './logic/rfc-4-room-connection'
import { RoomConnection } from './interface/index'
import { LighthouseConnectionConfig, LighthouseWorldInstanceConnection } from './v2/LighthouseWorldInstanceConnection'
import { Authenticator, AuthIdentity } from '@dcl/crypto'
import { getCommsServer } from '../dao/selectors'
import { store } from 'shared/store/isolatedStore'
import { getCommsConfig } from 'shared/meta/selectors'
import { ensureMetaConfigurationInitialized } from 'shared/meta/index'
import { getIdentity } from 'shared/session'
import { setCommsIsland } from './actions'
import { commsLogger, CommsContext } from './context'
import { getCurrentIdentity } from 'shared/session/selectors'
import { getCommsContext } from './selectors'
import { Realm } from 'shared/dao/types'
import { resolveCommsV4Urls, resolveCommsV3Urls } from './v3/resolver'
import { BFFConnection } from './v3/BFFConnection'
import { InstanceConnection as V3InstanceConnection } from './v3/InstanceConnection'
import { lastPlayerPositionReport } from 'shared/world/positionThings'
import { ProfileType } from 'shared/profiles/types'
import { OfflineRoomConnection } from './offline-room-connection'

export type CommsVersion = 'v1' | 'v2' | 'v3' | 'v4' | 'offline'
export type CommsMode = CommsV1Mode | CommsV2Mode
export type CommsV1Mode = 'local' | 'remote'
export type CommsV2Mode = 'p2p' | 'server'

export function sendPublicChatMessage(message: string) {
  const commsContext = getCommsContext(store.getState())

  commsContext?.worldInstanceConnection
    .sendChatMessage({
      message
    })
    .catch((e) => commsLogger.warn(`error while sending message `, e))
}

export function sendParcelSceneCommsMessage(sceneId: string, data: Uint8Array) {
  const commsContext = getCommsContext(store.getState())

  commsContext?.worldInstanceConnection
    .sendParcelSceneMessage({
      data,
      sceneId
    })
    .catch((e) => commsLogger.warn(`error while sending message `, e))
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

      connection = new Rfc4RoomConnection(new Rfc5BrokerConnection(url.href, identity))
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
        logLevel: DEBUG_COMMS ? 'TRACE' : 'NONE',
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
        preferedIslandId: PREFERED_ISLAND ?? ''
      }

      if (!commsConfig.relaySuspensionDisabled) {
        peerConfig.relaySuspensionConfig = {
          relaySuspensionInterval: commsConfig.relaySuspensionInterval ?? 750,
          relaySuspensionDuration: commsConfig.relaySuspensionDuration ?? 5000
        }
      }

      commsLogger.log('Using Remote lighthouse service: ', lighthouseUrl)

      const lighthouse = (connection = new LighthouseWorldInstanceConnection(
        lighthouseUrl,
        peerConfig,
        (status) => {
          commsLogger.log('Lighthouse status: ', status)
          switch (status.status) {
            case 'realm-full':
            case 'reconnection-error':
            case 'id-taken':
              connection.disconnect().catch(commsLogger.error)
              break
          }
        },
        identity
      ))

      lighthouse.onIslandChangedObservable.add(({ island }) => {
        store.dispatch(setCommsIsland(island))
      })

      break
    }
    case 'v3': {
      await ensureMetaConfigurationInitialized()

      const { wsUrl } = resolveCommsV3Urls(realm)!

      commsLogger.log('Using BFF service: ', wsUrl)
      const bff = new BFFConnection(wsUrl, identity)
      connection = new V3InstanceConnection(bff)
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
      connection = new Rfc4RoomConnection(new Rfc5BrokerConnection(finalUrl, identity))

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
