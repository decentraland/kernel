import { ILogger, createLogger } from 'shared/logger'
import { Observable } from 'mz-observable'
import { AuthIdentity, Authenticator } from 'dcl-crypto'
import { createRpcClient, RpcClientPort, Transport } from '@dcl/rpc'
import { WebSocketTransport } from '@dcl/rpc/dist/transports/WebSocket'
import { loadService, RpcClientModule } from '@dcl/rpc/dist/codegen'
import { BffAuthenticationServiceDefinition, WelcomePeerInformation } from './proto/bff/authentication-service'
import { CommsServiceDefinition } from './proto/bff/comms-service'

export declare type BFFConfig = {
  getIdentity: () => AuthIdentity
}

export type TopicData = {
  peerId: string
  data: Uint8Array
}

export type PeerTopicListener = {
  topic: string
  handler: (data: Uint8Array, peerId: string) => void
}

export type SystemTopicListener = {
  topic: string
  handler: (data: Uint8Array) => void
}

export class BFFConnection {
  private logger: ILogger = createLogger('BFF: ')

  public onDisconnectObservable = new Observable<void>()
  public onTopicMessageObservable = new Observable<TopicData>()

  private wsTransport: Transport | null = null

  private sceneTopics = new Map<string, PeerTopicListener>()

  private commsService: RpcClientModule<CommsServiceDefinition, any> | null = null

  constructor(private url: string, private config: BFFConfig) {}

  async connect(): Promise<string> {
    this.wsTransport = WebSocketTransport(new WebSocket(this.url, 'comms'))
    this.wsTransport.on('close', async () => {
      this.logger.log('transport closed')
      await this.disconnect()
    })
    this.wsTransport.on('error', async () => {
      this.logger.log('transport closed')
      await this.disconnect()
    })
    const rpcClient = await createRpcClient(this.wsTransport)
    const port = await rpcClient.createPort('kernel')
    const peerId = await this.authenticate(port)

    this.commsService = loadService(port, CommsServiceDefinition)
    this.logger.log('Connected')
    return peerId
  }

  public addPeerTopicListener(topic: string, handler: (data: Uint8Array, peerId: string) => void): PeerTopicListener {
    if (!this.commsService) {
      throw new Error('BFF is not connected')
    }

    const l = { topic, handler }
    ;(async (commsService) => {
      for await (const { payload, sender } of commsService.subscribeToPeerTopic({ topic })) {
        l.handler(payload, sender)
      }
    })(this.commsService)

    return l
  }

  public addSystemTopicListener(topic: string, handler: (data: Uint8Array) => void): SystemTopicListener {
    if (!this.commsService) {
      throw new Error('BFF is not connected')
    }

    const l = { topic, handler }
    ;(async (commsService) => {
      for await (const { payload } of commsService.subscribeToSystemTopic({ topic })) {
        l.handler(payload)
      }
    })(this.commsService)

    return l
  }

  public removePeerTopicListener({ topic }: PeerTopicListener): void {
    if (!this.commsService) {
      throw new Error('BFF is not connected')
    }

    this.commsService.unsubscribeToTopic({ topic, system: false })
  }

  public removeSystemTopicListener({ topic }: SystemTopicListener): void {
    if (!this.commsService) {
      throw new Error('BFF is not connected')
    }

    this.commsService.unsubscribeToTopic({ topic, system: true })
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
        this.removePeerTopicListener(l)
      }
      this.sceneTopics.delete(topic)
    })

    topicsToAdd.forEach((topic) => {
      this.sceneTopics.set(topic, this.addPeerTopicListener(topic, this.onSceneMessage))
    })
  }

  async disconnect() {
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

  private onSceneMessage(data: Uint8Array, peerId: string) {
    this.onTopicMessageObservable.notifyObservers({
      peerId,
      data
    })
  }
}
