import { expect } from 'chai'
import * as r from 'shared/realm/resolver'

function eq<T>(given: T, expected: T) {
  console.log({ given, expected })
  expect(given).to.deep.eq(expected)
}

describe('Comms resolver', () => {
  it('resolveCommsConnectionString', async () => {
    eq(r.resolveRealmBaseUrlFromRealmQueryParameter('unknown', []), 'http://unknown')

    eq(
      r.resolveRealmBaseUrlFromRealmQueryParameter('unknown', [
        { catalystName: 'unknown', domain: 'unknowndomain', protocol: 'v2' } as any
      ]),
      'http://unknowndomain'
    )

    eq(
      r.resolveRealmBaseUrlFromRealmQueryParameter('dg', [
        { catalystName: 'dg', domain: 'peer.decentral1.io', protocol: 'v2' } as any
      ]),
      'http://peer.decentral1.io'
    )

    eq(
      r.resolveRealmBaseUrlFromRealmQueryParameter('peer.decentral2.io', [
        { catalystName: 'dg', domain: 'peer.decentral2.io', protocol: 'v2' } as any
      ]),
      'http://peer.decentral2.io'
    )

    eq(
      r.resolveRealmBaseUrlFromRealmQueryParameter('https://peer.decentral.io', [
        { catalystName: 'dg', domain: 'peer.decentral.io', protocol: 'v2' } as any
      ]),
      'https://peer.decentral.io'
    )

    eq(
      r.resolveRealmBaseUrlFromRealmQueryParameter('https://peer.decentral.io', [
        { catalystName: 'dg', domain: 'https://peer.decentral.io', protocol: 'v2' } as any
      ]),
      'https://peer.decentral.io'
    )
  })
})
