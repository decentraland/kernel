import { expect } from 'chai'
import * as sinon from 'sinon'

import { sleep } from 'atomicHelpers/sleep'
import { createFetch, FetchFunction } from 'scene-system/sdk/Fetch'

const originalFetch: FetchFunction = async (resource, init) => {
  return new Response()
}

describe('Fetch Wrapped for scenes', () => {
  const log = sinon.spy()
  const logPreview = sinon.spy()
  const wrappedProductionFetch = createFetch({
    canUseFetch: true,
    log,
    originalFetch,
    previewMode: false
  })
  const wrappedPreviewFetch = createFetch({
    canUseFetch: true,
    log: logPreview,
    originalFetch,
    previewMode: true
  })
  const wrappedNotAllowedFetch = createFetch({
    canUseFetch: false,
    log,
    originalFetch,
    previewMode: false
  })

  const timePerFetchSleep = 100
  const wrappedDelayFetch = createFetch({
    canUseFetch: true,
    log,
    originalFetch: async (_resource, init) => {
      await sleep(timePerFetchSleep)

      if (init!.signal?.aborted) {
        const a = new Error('Abort')
        a.name = 'AbortError'
        throw a
      }

      return new Response('Done', init)
    },
    previewMode: true
  })

  // *
  // * Deployed mode test
  // *

  it('should run successfully if the url is secure in deployed scenes', async () => {
    await wrappedProductionFetch('https://decentraland.org')
  })

  it('should throw an error if the url is not secure in deployed scenes', async () => {
    const throwErrorLogger = sinon.spy()
    try {
      await wrappedProductionFetch('http://decentraland.org')
    } catch (err) {
      throwErrorLogger(err)
    }
    sinon.assert.calledOnce(throwErrorLogger)
  })

  // *
  // * Preview mode test
  // *

  it('should run successfully if the url is secure in preview scenes', async () => {
    await wrappedPreviewFetch('https://decentraland.org')
  })

  it('should log an error if the url is not secure in preview scenes', async () => {
    sinon.assert.notCalled(logPreview)
    await wrappedPreviewFetch('http://decentraland.org')
    sinon.assert.calledOnce(logPreview)
  })

  // *
  // * Not allowed fetchs mode test
  // *

  it('should throw an error because it does not have permissions', async () => {
    const throwErrorLogger = sinon.spy()
    try {
      await wrappedNotAllowedFetch('https://decentraland.org')
    } catch (err) {
      throwErrorLogger(err)
    }
    sinon.assert.calledOnce(throwErrorLogger)
  })

  it('should execute only one fetch at the same time', async () => {
    let counter = 0
    const N = 10
    for (let i = 0; i < N; i++) {
      wrappedDelayFetch('https://test.test/').then(() => counter++)
    }
    await sleep(timePerFetchSleep * 1.2)
    expect(counter).to.eql(1)
    await sleep(timePerFetchSleep * 2)
    expect(counter).to.eql(3)
  })

  it('should abort fetch if reaches the timeout opt 1', async () => {
    let error: Error | null = null

    try {
      await wrappedDelayFetch('https://test.test/', { timeout: 10 })
    } catch (err: any) {
      console.log(err)
      error = err
    }
    expect(error!.name).to.eql('AbortError')
  })

  it('should abort fetch if reaches the timeout opt 2', async () => {
    let error: Error | null = null
    let counter = 0
    await Promise.all([
      wrappedDelayFetch('https://test.test/', { timeout: 5 }).catch((err) => {
        error = err
        counter++
      }),
      wrappedDelayFetch('https://test.test/', {}).then(() => counter++)
    ])
    expect(error!.name).to.eql('AbortError')
    expect(counter).to.eql(2)
  })
})
