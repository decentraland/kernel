import * as sinon from 'sinon'
import { createWebSocket } from '../../packages/scene-system/sdk/WebSocket'

class FakeWebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {}
}

describe('Websocket wrapped for scenes', () => {
  let originalWebSocket: any = WebSocket
  before(() => {
    originalWebSocket = WebSocket
    // @ts-ignore
    globalThis.WebSocket = FakeWebSocket
  })

  after(() => {
    globalThis.WebSocket = originalWebSocket
    originalWebSocket = null
  })
  const log = sinon.spy()
  const logPreview = sinon.spy()
  const wrappedProductionWebSocket = createWebSocket({
    canUseWebsocket: true,
    log,
    previewMode: false
  })
  const wrappedPreviewWebSocket = createWebSocket({
    canUseWebsocket: true,
    log: logPreview,
    previewMode: true
  })
  const wrappedNotAllowedWebSocket = createWebSocket({
    canUseWebsocket: false,
    log,
    previewMode: false
  })

  it('should run successfully if the ws is secure in deployed scenes', async () => {
    new wrappedProductionWebSocket('wss://decentraland.org')
  })

  it('should throw an error if the ws is not secure in deployed scenes', async () => {
    const throwErrorLogger = sinon.spy()
    try {
      new wrappedProductionWebSocket('http://decentraland.org')
    } catch (err) {
      throwErrorLogger(err)
    }
    sinon.assert.calledOnce(throwErrorLogger)
  })

  it('should run successfully if the ws is secure in preview scenes', async () => {
    new wrappedPreviewWebSocket('wss://rpc.decentraland.org/mainnet')
  })

  it('should log an error if the ws is not secure in preview scenes', async () => {
    sinon.assert.notCalled(logPreview)
    new wrappedPreviewWebSocket('ws://rpc.decentraland.org/mainnet')
    sinon.assert.calledOnce(logPreview)
  })

  it('should throw an error because it does not have permissions', async () => {
    const throwErrorLogger = sinon.spy()
    try {
      new wrappedNotAllowedWebSocket('wss://rpc.decentraland.org/mainnet')
    } catch (err) {
      throwErrorLogger(err)
    }
    sinon.assert.calledOnce(throwErrorLogger)
  })
})
