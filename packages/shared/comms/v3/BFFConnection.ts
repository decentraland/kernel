import { ILogger, createLogger } from 'shared/logger'
import { Observable } from 'mz-observable'
import { Authenticator } from '@dcl/crypto'
import { createRpcClient, RpcClientPort, Transport } from '@dcl/rpc'
import { WebSocketTransport } from '@dcl/rpc/dist/transports/WebSocket'
import { loadService, RpcClientModule } from '@dcl/rpc/dist/codegen'
import {
  BffAuthenticationServiceDefinition,
  WelcomePeerInformation
} from 'shared/protocol/bff/authentication-service.gen'
import { CommsServiceDefinition } from 'shared/protocol/bff/comms-service.gen'
import { trackEvent } from 'shared/analytics'
import { ExplorerIdentity } from 'shared/session/types'

type CommsService = RpcClientModule<CommsServiceDefinition, any>

export type TopicData = {
  peerId: string
  data: Uint8Array
}

export type TopicListener = {
  subscriptionId: number
}

export class BFFConnection {
  private logger: ILogger = createLogger('BFF: ')

  public onDisconnectObservable = new Observable<void>()
  private wsTransport: Transport | null = null

  private commsService: CommsService | null = null
  private disposed = false

  constructor(private url: string, private identity: ExplorerIdentity) {}

  async connect(): Promise<string> {
    this.wsTransport = WebSocketTransport(new WebSocket(this.url, 'comms'))
    this.wsTransport.on('close', async () => {
      this.logger.log('BFF transport closed')
      this.disconnect()
    })
    this.wsTransport.on('error', async () => {
      this.logger.log('BFF transport closed')
      this.disconnect()
    })
    const rpcClient = await createRpcClient(this.wsTransport)
    const port = await rpcClient.createPort('kernel')
    const peerId = await this.authenticate(port)

    this.commsService = loadService(port, CommsServiceDefinition)
    this.logger.log('Connected')

    return peerId
  }

  public async addPeerTopicListener(
    topic: string,
    handler: (data: Uint8Array, peerId: string) => Promise<void>
  ): Promise<TopicListener> {
    if (!this.commsService) {
      throw new Error('BFF is not connected')
    }

    const subscription = await this.commsService.subscribeToPeerMessages({ topic })

    async function getAsyncMessages(commsService: CommsService) {
      for await (const { payload, sender } of commsService.getPeerMessages(subscription)) {
        await handler(payload, sender)
      }
    }

    getAsyncMessages(this.commsService).catch((err) => {
      this.logger.error(`Peer topic handler error: ${err.toString()}`)
      this.disconnect()
    })

    return subscription
  }

  public async addSystemTopicListener(
    topic: string,
    handler: (data: Uint8Array) => Promise<void>
  ): Promise<TopicListener> {
    if (!this.commsService) {
      throw new Error('BFF is not connected')
    }

    const subscription = await this.commsService.subscribeToSystemMessages({ topic })

    async function getAsyncMessages(commsService: CommsService) {
      for await (const { payload } of commsService.getSystemMessages(subscription)) {
        await handler(payload)
      }
    }

    getAsyncMessages(this.commsService).catch((err) => {
      this.logger.error(`System topic handler error: ${err.toString()}`)
      this.disconnect()
    })

    return subscription
  }

  public async removePeerTopicListener({ subscriptionId }: TopicListener): Promise<void> {
    if (!this.commsService) {
      if (this.disposed) {
        return
      }
      throw new Error('BFF is not connected')
    }

    await this.commsService.unsubscribeToPeerMessages({ subscriptionId })
  }

  public async removeSystemTopicListener({ subscriptionId }: TopicListener): Promise<void> {
    if (!this.commsService) {
      if (this.disposed) {
        return
      }
      throw new Error('BFF is not connected')
    }

    await this.commsService.unsubscribeToSystemMessages({ subscriptionId })
  }

  public async publishToTopic(topic: string, payload: Uint8Array): Promise<void> {
    if (this.disposed) {
      return
    }

    if (!this.commsService) {
      throw new Error('BFF is not connected')
    }

    await this.commsService.publishToTopic({ topic, payload })
  }

  disconnect() {
    if (this.disposed) {
      return
    }

    this.disposed = true
    this.commsService = null
    if (this.wsTransport) {
      this.wsTransport.close()
      this.wsTransport = null
    }
    this.onDisconnectObservable.notifyObservers()
  }

  private async authenticate(port: RpcClientPort): Promise<string> {
    const address = this.identity.address

    const auth = loadService(port, BffAuthenticationServiceDefinition)

    const getChallengeResponse = await auth.getChallenge({ address })
    if (getChallengeResponse.alreadyConnected) {
      trackEvent('bff_auth_already_connected', {
        address
      })
    }

    const authChainJson = JSON.stringify(Authenticator.signPayload(this.identity, getChallengeResponse.challengeToSign))
    const authResponse: WelcomePeerInformation = await auth.authenticate({ authChainJson })
    return authResponse.peerId
  }
}
