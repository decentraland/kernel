import { expect } from 'chai'

import { sleep } from 'atomicHelpers/sleep'
import { flatFetch } from 'atomicHelpers/flatFetch'

describe('Signed Fetch' , () => {
  window.fetch = async (resource: RequestInfo, init: RequestInit & { timeout: number }) => {
    await sleep(100)
    if (init.signal?.aborted) {
      const a = new Error('Abort')
      a.name = 'AbortError'
      throw a
    }
    return new Response(JSON.stringify({ text: 'Done' }), init)
  }
  it('should abort fetch if reaches the timeout opt', async () => {
    let error: Error = null

    try {
      await flatFetch('https://boedo.casla/', { timeout: 10 })
    } catch (err) {
      console.log(err)
      error = err
    }
    expect(error.name).to.eql('AbortError')
  })

  it('should fetch and return a json response', async () => {
    const { json } = await flatFetch('https://boedo.casla/', { timeout: 1000, responseBodyType: 'json' })
    expect(json).to.eql({ text: 'Done' })
  })

  it('should fetch and return a text response ', async () => {
    const { text } = await flatFetch('https://boedo.casla/', { timeout: 1000 })
    expect(text).to.eql(JSON.stringify({ text: 'Done' }))
  })
})
