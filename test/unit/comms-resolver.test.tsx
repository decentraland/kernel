import { expect } from 'chai'
import * as r from 'shared/comms/v3/resolver'

function eq<T>(given: T, expected: T) {
  console.log({ given, expected })
  expect(given).to.deep.eq(expected)
}

describe('Comms resolver', () => {
  it('resolveCommsConnectionString', async () => {
    eq(await r.resolveCommsConnectionString('v1~local', []), {
      protocol: 'v1',
      serverName: 'local',
      hostname: 'http://local'
    })

    eq(await r.resolveCommsConnectionString('unknown', []), undefined)

    eq(
      await r.resolveCommsConnectionString('unknown', [
        { catalystName: 'unknown', domain: 'unknowndomain', protocol: 'v2' } as any
      ]),
      {
        hostname: 'http://unknowndomain',
        protocol: 'v2',
        serverName: 'unknown'
      }
    )

    eq(
      await r.resolveCommsConnectionString('v2~dg', [
        { catalystName: 'dg', domain: 'peer.decentral.io', protocol: 'v2' } as any
      ]),
      {
        hostname: 'http://peer.decentral.io',
        protocol: 'v2',
        serverName: 'dg'
      }
    )

    eq(
      await r.resolveCommsConnectionString('v2~peer.decentral.io', [
        { catalystName: 'dg', domain: 'peer.decentral.io', protocol: 'v2' } as any
      ]),
      {
        hostname: 'http://peer.decentral.io',
        protocol: 'v2',
        serverName: 'dg'
      }
    )

    eq(
      await r.resolveCommsConnectionString('v2~https://peer.decentral.io', [
        { catalystName: 'dg', domain: 'peer.decentral.io', protocol: 'v2' } as any
      ]),
      {
        hostname: 'https://peer.decentral.io',
        protocol: 'v2',
        serverName: 'https://peer.decentral.io'
      }
    )

    eq(
      await r.resolveCommsConnectionString('v2~https://peer.decentral.io', [
        { catalystName: 'dg', domain: 'https://peer.decentral.io', protocol: 'v2' } as any
      ]),
      {
        hostname: 'https://peer.decentral.io',
        protocol: 'v2',
        serverName: 'dg'
      }
    )
  })

  it('realmToConnectionString', async () => {
    eq(r.realmToConnectionString({ hostname: 'test', protocol: 'v2', serverName: 'abc' }), 'abc')
    eq(
      r.realmToConnectionString({ hostname: 'http://test.com', protocol: 'v2', serverName: 'http://test.com' }),
      'v2~test.com'
    )
    eq(
      r.realmToConnectionString({ hostname: 'https://test.com', protocol: 'v2', serverName: 'https://test.com' }),
      'v2~test.com'
    )
    eq(
      r.realmToConnectionString({ hostname: 'ws://test.com', protocol: 'v3', serverName: 'ws://test.com' }),
      'v3~test.com'
    )
    eq(
      r.realmToConnectionString({ hostname: 'wss://test.com', protocol: 'v3', serverName: 'wss://test.com' }),
      'v3~test.com'
    )
  })

  it('resolveCommsV3Urls', async () => {
    eq(r.resolveCommsV3Urls({ hostname: 'test', protocol: 'v2', serverName: 'abc' }), undefined)
    eq(r.resolveCommsV3Urls({ hostname: 'http://test.com', protocol: 'v3', serverName: 'http://test.com' }), {
      pingUrl: 'http://test.com/about',
      wsUrl: 'ws://test.com/bff/rpc'
    })
  })

  it('resolveCommsV4Urls', async () => {
    eq(r.resolveCommsV4Urls({ hostname: 'test', protocol: 'v2', serverName: 'abc' }), undefined)
    eq(r.resolveCommsV4Urls({ hostname: 'http://test.com', protocol: 'v4', serverName: 'http://test.com' }), {
      pingUrl: 'http://test.com/status',
      wsUrl: 'ws://test.com/ws'
    })
  })
})
