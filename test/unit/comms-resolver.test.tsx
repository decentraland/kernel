import { expect } from 'chai'
import * as r from 'shared/bff/resolver'

function eq<T>(given: T, expected: T) {
  console.log({ given, expected })
  expect(given).to.deep.eq(expected)
}

describe('Comms resolver', () => {
  it('resolveCommsConnectionString', async () => {
    eq(r.resolveRealmBaseUrlFromRealmQueryParameter('v1~local', []), 'http://local')

    eq(r.resolveRealmBaseUrlFromRealmQueryParameter('unknown', []), undefined)

    eq(
      r.resolveRealmBaseUrlFromRealmQueryParameter('unknown', [
        { catalystName: 'unknown', domain: 'unknowndomain', protocol: 'v2' } as any
      ]),
      'http://unknowndomain'
    )

    eq(
      r.resolveRealmBaseUrlFromRealmQueryParameter('v2~dg', [
        { catalystName: 'dg', domain: 'peer.decentral.io', protocol: 'v2' } as any
      ]),
      'http://peer.decentral.io'
    )

    eq(
      r.resolveRealmBaseUrlFromRealmQueryParameter('v2~peer.decentral.io', [
        { catalystName: 'dg', domain: 'peer.decentral.io', protocol: 'v2' } as any
      ]),
      'http://peer.decentral.io'
    )

    eq(
      r.resolveRealmBaseUrlFromRealmQueryParameter('v2~https://peer.decentral.io', [
        { catalystName: 'dg', domain: 'peer.decentral.io', protocol: 'v2' } as any
      ]),
      'https://peer.decentral.io'
    )

    eq(
      r.resolveRealmBaseUrlFromRealmQueryParameter('v2~https://peer.decentral.io', [
        { catalystName: 'dg', domain: 'https://peer.decentral.io', protocol: 'v2' } as any
      ]),
      'https://peer.decentral.io'
    )
  })

  // it('realmToConnectionString', async () => {
  //   eq(r.realmToConnectionString({ hostname: 'test', protocol: 'v2', serverName: 'abc' }), 'abc')
  //   eq(
  //     r.realmToConnectionString({ hostname: 'http://test.com', protocol: 'v2', serverName: 'http://test.com' }),
  //     'v2~test.com'
  //   )
  //   eq(
  //     r.realmToConnectionString({ hostname: 'https://test.com', protocol: 'v2', serverName: 'https://test.com' }),
  //     'v2~test.com'
  //   )
  //   eq(
  //     r.realmToConnectionString({ hostname: 'ws://test.com', protocol: 'v3', serverName: 'ws://test.com' }),
  //     'v3~test.com'
  //   )
  //   eq(
  //     r.realmToConnectionString({ hostname: 'wss://test.com', protocol: 'v3', serverName: 'wss://test.com' }),
  //     'v3~test.com'
  //   )
  // })
})
