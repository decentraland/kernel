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

describe('Safe fetch and WebSocket permissions', () => {
  it('fetch', async () => {

    const log = sinon.spy()
    const logErrorPreview = sinon.spy()
    const logErrorNotAllowed = sinon.spy()

    const fetch_deployed = createFetch({
      canUseFetch: true, log, originalFetch, previewMode: false
    })
    const fetch_preview = createFetch({
      canUseFetch: true, log, originalFetch, previewMode: true
    })
    const not_allowed_fetch = createFetch({
      canUseFetch: false, log, originalFetch, previewMode: false
    })

    await fetch_deployed("https://decentraland.org")

    try {
      await fetch_deployed("http://decentraland.org")
    } catch (err) {
      logErrorPreview(err)
    }

    await fetch_preview("http://decentraland.org")
    await fetch_preview("https://decentraland.org")

    try {
      await not_allowed_fetch("https://decentraland.org")
    } catch (err) {
      logErrorNotAllowed(err)
    }

    sinon.assert.calledOnce(logErrorPreview)
    sinon.assert.calledOnce(logErrorNotAllowed)
    sinon.assert.calledOnce(log)
  })

  it('websocket ', async () => {
    const log = sinon.spy()
    const logErrorPreview = sinon.spy()
    const logErrorNotAllowed = sinon.spy()

    const deployed_WebSocket = createWebSocket({
      canUseWebsocket: true, log, previewMode: false
    })
    
    const preview_WebSocket = createWebSocket({
      canUseWebsocket: true, log, previewMode: true
    })

    const not_allowed_WebSocket = createWebSocket({
      canUseWebsocket: false, log, previewMode: false
    })


    new deployed_WebSocket("wss://decentraland.org")

    try {
      new deployed_WebSocket("ws://decentraland.org")
    } catch (err) {
      logErrorPreview(err)
    }

    new preview_WebSocket("ws://decentraland.org")
    new preview_WebSocket("wss://decentraland.org")

    try {
      new not_allowed_WebSocket("wss://decentraland.org")
    } catch (err) {
      logErrorNotAllowed(err)
    }

    sinon.assert.calledOnce(logErrorPreview)
    sinon.assert.calledOnce(logErrorNotAllowed)
    sinon.assert.calledOnce(log)
  })

})