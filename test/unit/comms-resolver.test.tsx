import { expect } from 'chai'
import { resolveRealmConfigFromString } from 'shared/dao'
import * as r from 'shared/realm/resolver'

function eq<T>(given: T, expected: T) {
  try {
    expect(given).to.deep.eq(expected)
  } catch (e) {
    console.log({ given, expected })
    throw e
  }
}

describe('Comms resolver', () => {
  it('resolveRealmConfigFromString', async () => {
    eq(await resolveRealmConfigFromString('offline'), {
      about: {
        bff: undefined,
        comms: {
          healthy: false,
          protocol: 'offline',
          fixedAdapter: undefined
        },
        configurations: {
          realmName: 'offline',
          networkId: 1,
          globalScenesUrn: [],
          scenesUrn: []
        },
        content: {
          healthy: true,
          publicUrl: 'https://peer.decentraland.org/content'
        },
        healthy: true,
        lambdas: {
          healthy: true,
          publicUrl: 'https://peer.decentraland.org/lambdas'
        }
      },
      baseUrl: 'https://peer.decentraland.org/'
    })

    eq(await resolveRealmConfigFromString('offline?baseUrl=peer.decentraland.zone'), {
      about: {
        bff: undefined,
        comms: {
          healthy: false,
          protocol: 'offline',
          fixedAdapter: undefined
        },
        configurations: {
          realmName: 'offline',
          networkId: 1,
          globalScenesUrn: [],
          scenesUrn: []
        },
        content: {
          healthy: true,
          publicUrl: 'http://peer.decentraland.zone/content'
        },
        healthy: true,
        lambdas: {
          healthy: true,
          publicUrl: 'http://peer.decentraland.zone/lambdas'
        }
      },
      baseUrl: 'http://peer.decentraland.zone/'
    })
    eq(await resolveRealmConfigFromString('offline?baseUrl=https://peer.decentraland.zone'), {
      about: {
        bff: undefined,
        comms: {
          healthy: false,
          protocol: 'offline',
          fixedAdapter: undefined
        },
        configurations: {
          realmName: 'offline',
          networkId: 1,
          globalScenesUrn: [],
          scenesUrn: []
        },
        content: {
          healthy: true,
          publicUrl: 'https://peer.decentraland.zone/content'
        },
        healthy: true,
        lambdas: {
          healthy: true,
          publicUrl: 'https://peer.decentraland.zone/lambdas'
        }
      },
      baseUrl: 'https://peer.decentraland.zone/'
    })
  })
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
