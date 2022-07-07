import sinon from 'sinon'
import { expect } from 'chai'
import { fetchCatalystStatuses } from 'shared/dao'
import * as ping from 'shared/dao/utils/ping'
import { Candidate, PingResult } from 'shared/dao/types'

const pingResult = (maxUsers?: number): PingResult => ({
  status: 0,
  elapsed: 309,
  result: {
    name: 'loki',
    version: '1.0.0',
    usersCount: 59,
    maxUsers: maxUsers || 1000
  }
})

const NODES = [
  {
    domain: 'peer.decentraland.org'
  },
  {
    domain: 'peer-ec1.decentraland.org'
  }
]

const EXPECTED: Candidate = {
  protocol: 'v2',
  catalystName: 'loki',
  domain: 'peer.decentraland.org',
  elapsed: 309,
  lighthouseVersion: '1.0.0',
  maxUsers: 1000,
  status: 0,
  type: 'islands-based',
  usersCount: 59,
  usersParcels: undefined
}

describe('Fetch catalyst server status', () => {
  beforeEach(() => {
    sinon.reset()
    sinon.restore()
  })

  it('Should return all the catalyst status servers', async () => {
    const stub = sinon.stub(ping, 'ping')

    stub.callsFake(async (domain) => ({ ...pingResult(), domain }))
    const results = await fetchCatalystStatuses(NODES)
    expect(results).to.eql(NODES.map((n) => ({ ...EXPECTED, domain: n.domain })))
  })

  it('Should filter the servers where the usersCount > maxUsers', async () => {
    const stub = sinon.stub(ping, 'ping')

    stub.callsFake(async (domain) => {
      const maxUsers = domain.startsWith(NODES[0].domain) ? 10 : 1000
      return {
        ...pingResult(maxUsers),
        domain
      }
    })
    const results = await fetchCatalystStatuses(NODES)
    expect(results).to.eql(NODES.slice(1).map((n) => ({ ...EXPECTED, domain: n.domain })))
  })
})
