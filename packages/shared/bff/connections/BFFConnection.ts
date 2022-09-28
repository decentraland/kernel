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
import { legacyServices } from '../local-services/legacy'
import { AboutResponse } from 'shared/protocol/bff/http-endpoints.gen'

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

export async function createBffRpcConnection(
  baseUrl: string,
  about: AboutResponse,
  identity: ExplorerIdentity
): Promise<IBff> {
  const relativeUrl = ((about.bff?.publicUrl || '/bff') + '/rpc').replace(/(\/+)/g, '/')

  const wsUrl = new URL(relativeUrl, baseUrl).toString().replace(/^http/, 'ws')
  const bffTransport = WebSocketTransport(new WebSocket(wsUrl, 'bff'))

  const rpcClient = await createRpcClient(bffTransport)
  const port = await rpcClient.createPort('kernel')

  const peerId = await authenticatePort(port, identity)

  // close the WS when the port is closed
  port.on('close', () => bffTransport.close())

  return new BffRpcConnection(baseUrl, about, port, peerId)
}

export class BffRpcConnection implements IBff<any> {
  public events = mitt<BffEvents>()
  public services: BffServices

  private logger: ILogger = createLogger('BFF: ')
  private disposed = false

  constructor(
    public baseUrl: string,
    public readonly about: AboutResponse,
    public port: RpcClientPort,
    public peerId: string
  ) {
    port.on('close', async () => {
      this.logger.log('BFF transport closed')
      this.disconnect().catch(this.logger.error)
    })

    this.services = {
      comms: loadService(port, CommsServiceDefinition),
      legacy: legacyServices(baseUrl, about)
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
