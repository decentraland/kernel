import { expect } from "chai"
import { allPeersScoreLink } from "shared/dao/pick-realm-algorithm/allPeers"
import { defaultAllPeersScoreConfig } from "shared/dao/pick-realm-algorithm/defaults"
import { AlgorithmLink } from "shared/dao/pick-realm-algorithm/types"
import { contextForCandidates } from "./test-utils"

describe('All Peers Score Link', () => {
  let link: AlgorithmLink
  beforeEach(() => {
    link = allPeersScoreLink(defaultAllPeersScoreConfig)
  })

  it("Should sort by users when no max users is provided and select the first", () => {
    const context = link.pick(contextForCandidates([0, 0],
      { catalystName: "second", usersCount: 2000 },
      { catalystName: "first", usersCount: 2500 },
      { catalystName: "fourth", usersCount: 25 },
      { catalystName: "third", usersCount: 1000 })
    )

    expect(context.picked.map(it => it.catalystName)).to.eql(["first", "second", "third", "fourth"])
    expect(context.selected?.catalystName).to.eql("first")
  })

  it("should prefer more users until around 50% when max users are provided", () => {
    const context = link.pick(contextForCandidates([0, 0],
      { catalystName: "second", usersCount: 60, maxUsers: 100 },
      { catalystName: "first", usersCount: 45, maxUsers: 100 },
      { catalystName: "fourth", usersCount: 80, maxUsers: 100 },
      { catalystName: "third", usersCount: 20, maxUsers: 100 })
    )

    expect(context.picked.map(it => it.catalystName)).to.eql(["first", "second", "third", "fourth"])
    expect(context.selected?.catalystName).to.eql("first")
  })

  it("should prefer realms with at least 1 user", () => {
    const context = link.pick(contextForCandidates([0, 0],
      { catalystName: "second", usersCount: 99, maxUsers: 100 },
      { catalystName: "first", usersCount: 1, maxUsers: 100 },
      { catalystName: "third", usersCount: 0, maxUsers: 100 })
    )

    expect(context.picked.map(it => it.catalystName)).to.eql(["first", "second", "third"])
    expect(context.selected?.catalystName).to.eql("first")
  })

  it("should consider small latency with small differences", () => {
    const context = link.pick(contextForCandidates([0, 0],
      { catalystName: "second", usersCount: 45, maxUsers: 100, elapsed: 400 },
      { catalystName: "first", usersCount: 42, maxUsers: 100, elapsed: 200 },
      { catalystName: "third", usersCount: 20, maxUsers: 100, elapsed: 200 })
    )

    expect(context.picked.map(it => it.catalystName)).to.eql(["first", "second", "third"])
    expect(context.selected?.catalystName).to.eql("first")
  })

  it("should consider large latency with large differences", () => {
    const context = link.pick(contextForCandidates([0, 0],
      { catalystName: "second", usersCount: 1000, elapsed: 2000 },
      { catalystName: "first", usersCount: 900, elapsed: 200 },
      { catalystName: "third", usersCount: 1500, elapsed: 4000 })
    )

    expect(context.picked.map(it => it.catalystName)).to.eql(["first", "second", "third"])
    expect(context.selected?.catalystName).to.eql("first")
  })

  it("should penalize full realms", () => {
    const context = link.pick(contextForCandidates([0, 0],
      { catalystName: "second", usersCount: 100, maxUsers: 100 },
      { catalystName: "first", usersCount: 0, maxUsers: 100 })
    )

    expect(context.picked.map(it => it.catalystName)).to.eql(["first", "second"])
    expect(context.selected?.catalystName).to.eql("first")
  })

})