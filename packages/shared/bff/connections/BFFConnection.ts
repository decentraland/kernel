import { ILogger, createLogger } from 'shared/logger'
import { Authenticator } from '@dcl/crypto'
import { createRpcClient, RpcClientPort } from '@dcl/rpc'
import { WebSocketTransport } from '@dcl/rpc/dist/transports/WebSocket'
import { loadService } from '@dcl/rpc/dist/codegen'
import {
  BffAuthenticationServiceDefinition,
  WelcomePeerInformation
} from 'shared/protocol/bff/authentication-service.gen'
import { CommsServiceDefinition } from 'shared/protocol/bff/comms-service.gen'
import { trackEvent } from 'shared/analytics'
import { ExplorerIdentity } from 'shared/session/types'
import { BffEvents, BffServices, IBff } from '../types'
import mitt from 'mitt'
import { Realm } from 'shared/dao/types'
import { legacyServices } from '../local-services/legacy'

export type TopicData = {
  peerId: string
  data: Uint8Array
}

export type TopicListener = {
  subscriptionId: number
}

async function authenticatePort(port: RpcClientPort, identity: ExplorerIdentity): Promise<string> {
  const address = identity.address

  const auth = loadService(port, BffAuthenticationServiceDefinition)

  const getChallengeResponse = await auth.getChallenge({ address })
  if (getChallengeResponse.alreadyConnected) {
    trackEvent('bff_auth_already_connected', {
      address
    })
  }

  const authChainJson = JSON.stringify(Authenticator.signPayload(identity, getChallengeResponse.challengeToSign))
  const authResponse: WelcomePeerInformation = await auth.authenticate({ authChainJson })
  return authResponse.peerId
}

export async function createBffRpcConnection(realm: Realm, url: string, identity: ExplorerIdentity): Promise<IBff> {
  const bffTransport = WebSocketTransport(new WebSocket(url, 'comms'))

  const rpcClient = await createRpcClient(bffTransport)
  const port = await rpcClient.createPort('kernel')

  const peerId = await authenticatePort(port, identity)

  // close the WS when the port is closed
  port.on('close', () => bffTransport.close())

  return new BffRpcConnection(realm, port, peerId)
}

export class BffRpcConnection implements IBff<{}> {
  public events = mitt<BffEvents>()
  public services: BffServices

  private logger: ILogger = createLogger('BFF: ')
  private disposed = false

  constructor(public readonly realm: Realm, public port: RpcClientPort, public peerId: string) {
    port.on('close', async () => {
      this.logger.log('BFF transport closed')
      this.disconnect()
    })

    this.services = {
      comms: loadService(port, CommsServiceDefinition),
      legacy: legacyServices(realm)
    }
  }

  async disconnect(error?: Error) {
    if (this.disposed) {
      return
    }

    this.disposed = true

    if (this.port) {
      this.port.close()
    }

    this.events.emit('DISCONNECTION', { error })
  }
}
