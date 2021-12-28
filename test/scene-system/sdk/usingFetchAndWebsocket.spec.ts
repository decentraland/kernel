import * as sinon from 'sinon'
import { createFetch, FetchFunction } from '../../../packages/scene-system/sdk/Fetch'
import { createWebSocket } from '../../../packages/scene-system/sdk/WebSocket'

const originalFetch: FetchFunction = async (resource: RequestInfo, init?: RequestInit) => {
  return new Response()
}

class FakeWebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {

  }
}

let originalWebSocket;

before(() => {
  originalWebSocket = WebSocket
  // @ts-ignore
  globalThis.WebSocket = FakeWebSocket
})

after(() => {
  globalThis.WebSocket = originalWebSocket
  originalWebSocket = null
})

describe('creating wrapped Fetch', () => {
  const log = sinon.spy()
  const logPreview = sinon.spy()
  const wrappedProductionFetch = createFetch({
    canUseFetch: true, log, originalFetch, previewMode: false
  })
  const wrappedPreviewFetch = createFetch({
    canUseFetch: true, log: logPreview, originalFetch, previewMode: true
  })
  const wrappedNotAllowedFetch = createFetch({
    canUseFetch: false, log, originalFetch, previewMode: false
  })

  // *
  // * Deployed mode test
  // *

  it('should run successfully if the url is secure in deployed scenes', async () => {
    await wrappedProductionFetch("https://decentraland.org")
  })

  it('should throw an error if the url is not secure in deployed scenes', async () => {
    const throwErrorLogger = sinon.spy()
    try {
      await wrappedProductionFetch("http://decentraland.org")
    } catch (err) {
      throwErrorLogger(err)
    }
    sinon.assert.calledOnce(throwErrorLogger)
  })

  // *
  // * Preview mode test
  // *

  it('should run successfully if the url is secure in preview scenes', async () => {
    await wrappedPreviewFetch("https://decentraland.org")
  })

  it('should log an error if the url is not secure in preview scenes', async () => {
    sinon.assert.notCalled(logPreview)
    await wrappedPreviewFetch("http://decentraland.org")
    sinon.assert.calledOnce(logPreview)
  })

  // *
  // * Not allowed fetchs mode test
  // *

  it('should throw an error because it does not have permissions', async () => {
    const throwErrorLogger = sinon.spy()
    try {
      await wrappedNotAllowedFetch("https://decentraland.org")
    } catch (err) {
      throwErrorLogger(err)
    }
    sinon.assert.calledOnce(throwErrorLogger)
  })

})

describe('creating wrapped WebSocket', () => {
  const log = sinon.spy()
  const logPreview = sinon.spy()
  const wrappedProductionWebSocket = createWebSocket({
    canUseWebsocket: true, log, previewMode: false
  })
  const wrappedPreviewWebSocket = createWebSocket({
    canUseWebsocket: true, log: logPreview, previewMode: true
  })
  const wrappedNotAllowedWebSocket = createWebSocket({
    canUseWebsocket: false, log, previewMode: false
  })

  it('should run successfully if the ws is secure in deployed scenes', async () => {
    new wrappedProductionWebSocket("wss://decentraland.org")
  })


  it('should throw an error if the ws is not secure in deployed scenes', async () => {
    const throwErrorLogger = sinon.spy()
    try {
      new wrappedProductionWebSocket("http://decentraland.org")
    } catch (err) {
      throwErrorLogger(err)
    }
    sinon.assert.calledOnce(throwErrorLogger)
  })


  it('should run successfully if the ws is secure in preview scenes', async () => {
    new wrappedPreviewWebSocket("wss://decentraland.org")
  })

  it('should log an error if the ws is not secure in preview scenes', async () => {
    sinon.assert.notCalled(logPreview)
    new wrappedPreviewWebSocket("ws://decentraland.org")
    sinon.assert.calledOnce(logPreview)
  })

  it('should throw an error because it does not have permissions', async () => {
    const throwErrorLogger = sinon.spy()
    try {
      new wrappedNotAllowedWebSocket("wss://decentraland.org")
    } catch (err) {
      throwErrorLogger(err)
    }
    sinon.assert.calledOnce(throwErrorLogger)
  })
})