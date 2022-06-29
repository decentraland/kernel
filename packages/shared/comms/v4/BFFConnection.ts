import { ILogger, createLogger } from 'shared/logger'
import { Observable } from 'mz-observable'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { createRpcClient, RpcClientPort, Transport } from '@dcl/rpc'
import { WebSocketTransport } from '@dcl/rpc/dist/transports/WebSocket'
import { loadService, RpcClientModule } from '@dcl/rpc/dist/codegen'
import { BffAuthenticationServiceDefinition, WelcomePeerInformation } from './proto/bff/authentication-service.gen'
import { CommsServiceDefinition } from './proto/bff/comms-service.gen'

export declare type BFFConfig = {
  getIdentity: () => AuthIdentity
}

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
  public onTopicMessageObservable = new Observable<TopicData>()

  private wsTransport: Transport | null = null

  private sceneTopics = new Map<string, TopicListener>()

  private commsService: RpcClientModule<CommsServiceDefinition, any> | null = null

  constructor(private url: string, private config: BFFConfig) {}

  async connect(): Promise<string> {
    this.wsTransport = WebSocketTransport(new WebSocket(this.url, 'comms'))
    this.wsTransport.on('close', async () => {
      this.logger.log('transport closed')
      this.disconnect()
    })
    this.wsTransport.on('error', async () => {
      this.logger.log('transport closed')
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

    ;(async (commsService) => {
      for await (const { payload, sender } of commsService.getPeerMessages(subscription)) {
        await handler(payload, sender)
      }
    })(this.commsService).catch((err) => {
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

    ;(async (commsService) => {
      for await (const { payload } of commsService.getSystemMessages(subscription)) {
        await handler(payload)
      }
    })(this.commsService).catch((err) => {
      this.logger.error(`System topic handler error: ${err.toString()}`)
      this.disconnect()
    })
    return subscription
  }

  public async removePeerTopicListener({ subscriptionId }: TopicListener): Promise<void> {
    if (!this.commsService) {
      throw new Error('BFF is not connected')
    }

    await this.commsService.unsubscribeToPeerMessages({ subscriptionId })
  }

  public async removeSystemTopicListener({ subscriptionId }: TopicListener): Promise<void> {
    if (!this.commsService) {
      throw new Error('BFF is not connected')
    }

    await this.commsService.unsubscribeToSystemMessages({ subscriptionId })
  }

  public async publishToTopic(topic: string, payload: Uint8Array): Promise<void> {
    if (!this.commsService) {
      throw new Error('BFF is not connected')
    }

    await this.commsService.publishToTopic({ topic, payload })
  }

  // TODO: replace this method with a listener
  public async setTopics(topics: string[]): Promise<void> {
    const newTopics = new Set<string>(topics)
    const topicsToRemove = new Set<string>()
    const topicsToAdd = new Set<string>()

    newTopics.forEach((topic) => {
      if (!this.sceneTopics.has(topic)) {
        topicsToAdd.add(topic)
      }
    })
    for (const topic of this.sceneTopics.keys()) {
      if (!newTopics.has(topic)) {
        topicsToRemove.add(topic)
      }
    }

    topicsToRemove.forEach((topic) => {
      const l = this.sceneTopics.get(topic)
      if (l) {
        this.removePeerTopicListener(l).catch((err) => {
          this.logger.error(`Error removing peer topic listener for ${topic}: ${err.toString()}`)
        })
      }
      this.sceneTopics.delete(topic)
    })

    topicsToAdd.forEach(async (topic) => {
      const l = await this.addPeerTopicListener(topic, this.onSceneMessage.bind(this))
      this.sceneTopics.set(topic, l)
    })
  }

  disconnect() {
    if (this.wsTransport) {
      this.wsTransport.close()
      this.wsTransport = null
      this.onDisconnectObservable.notifyObservers()
    }
  }

  private async authenticate(port: RpcClientPort): Promise<string> {
    const identity = this.config.getIdentity()
    const address = identity.authChain[0].payload

    const auth = loadService(port, BffAuthenticationServiceDefinition)

    const getChallengeResponse = await auth.getChallenge({ address })
    if (getChallengeResponse.alreadyConnected) {
      return address
    }

    const authChainJson = JSON.stringify(Authenticator.signPayload(identity, getChallengeResponse.challengeToSign))
    const authResponse: WelcomePeerInformation = await auth.authenticate({ authChainJson })
    return authResponse.peerId
  }

  private async onSceneMessage(data: Uint8Array, peerId: string) {
    this.onTopicMessageObservable.notifyObservers({
      peerId,
      data
    })
  }
}
