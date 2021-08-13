import { Candidate, Parcel } from "../types"
import { defaultAllPeersScoreConfig, defaultClosePeersScoreConfig, defaultLargeLatencyConfig } from "./defaults"
import { countParcelsCloseTo } from "../../comms/interface/utils"
import { AlgorithmChainConfig, AlgorithmLinkConfig, AlgorithmLinkTypes, AllPeersScoreParameters, ClosePeersScoreParameters, LargeLatencyParameters, LatencyDeductionsParameters } from "./types"
import { defaultLogger } from "shared/logger"

/**
 * The allCandidates attribute lists all candidates. The "picked" candidates is a sorted list of those candidates picked by all the previous links
 */
type AlgorithmContext = { allCandidates: Candidate[], picked: Candidate[], userParcel: Parcel, selected?: Candidate }

function usersCount(candidate: Candidate) {
  return candidate.type === 'layer-based' ? candidate.layer.usersCount : candidate.usersCount
}


function maxUsers(candidate: Candidate) {
  return candidate.type === 'layer-based' ? candidate.layer.maxUsers : candidate.maxUsers
}


function usersParcels(candidate: Candidate) {
  return candidate.type === 'layer-based' ? candidate.layer.usersParcels : candidate.usersParcels
}


function memoizedScores(scoreFunction: (c: Candidate) => number) {
  const scores = new Map<Candidate, number>()
  return (candidate: Candidate) => {
    if (!scores.has(candidate)) {
      scores.set(candidate, scoreFunction(candidate))
    }

    return scores.get(candidate)
  }
}

function latencyDeductions(candidate: Candidate, { multiplier, exponentialDivisor, maxDeduction }: LatencyDeductionsParameters) {
  const expResult = multiplier * (Math.exp(candidate.elapsed / exponentialDivisor) - 1)
  return Math.min(expResult, maxDeduction)
}


function scoreUsingLatencyDeductions(parameters: LatencyDeductionsParameters, baseScoreFunction: (c: Candidate) => number) {
  return (candidate: Candidate) => {
    const scoreByUsers = baseScoreFunction(candidate)

    return scoreByUsers - latencyDeductions(candidate, parameters)
  }
}

function selectFirstByScore(context: AlgorithmContext, score: (c: Candidate) => number) {
  const sorted = context.picked.sort((a, b) => score(b) - score(a))

  context.picked = sorted

  if (context.picked.length === 1 || score(context.picked[0]) > score(context.picked[1])) {
    context.selected = context.picked[0]
  }

  return context
}

type AlgorithmLink = {
  name: string,
  pick: (context: AlgorithmContext) => AlgorithmContext
}

function allUsersScoreLink({ baseScore, discourageFillTargetPercentage, fillTargetPercentage, latencyDeductionsParameters }: AllPeersScoreParameters): AlgorithmLink {
  function usersScore(candidate: Candidate) {
    const count = usersCount(candidate)
    const max = maxUsers(candidate)

    // We prefer realms that have users
    if (count === 0) return 0

    const linearUsersScore = (users: number) => baseScore + users

    if (max) {
      if (count >= max) return -baseScore // A full realm has negative score. They should've been filtered before, but you never know

      // We try to fill all realms until around the percentage provided
      if (count >= fillTargetPercentage * max) {
        // If this is the case, we are in the "downward" phase of the score
        // We calculate a segment joining the fillTargetPercentage% of users with baseScore at discourageFillTargetPercentage% maxUsers
        // In that way, when we reach discourageFillTargetPercentage% maxUsers, realms that have at least one user start to get prioritized
        const segment = { a: { x: fillTargetPercentage * max, y: linearUsersScore(fillTargetPercentage * max) }, b: { x: discourageFillTargetPercentage * max, y: baseScore } }

        const slope = (segment.b.y - segment.a.y) / (segment.b.x - segment.a.x)

        // The score is the result of calculating the corresponding point of this segment at usersCount
        return segment.a.y + slope * (count - segment.a.x)
      }
    } else {
      return linearUsersScore(count)
    }
  }

  return {
    name: AlgorithmLinkTypes.ALL_PEERS_SCORE,
    pick: (context: AlgorithmContext) => {
      const score = memoizedScores(scoreUsingLatencyDeductions(latencyDeductionsParameters, usersScore))

      return selectFirstByScore(context, score)
    }
  }
}


function largeLatencyLink({ largeLatencyThreshold }: LargeLatencyParameters, name?: string): AlgorithmLink {
  return {
    name: AlgorithmLinkTypes.LARGE_LATENCY,
    pick: (context: AlgorithmContext) => {
      const sorted = context.picked.sort((a, b) => a.elapsed - b.elapsed)

      const minElapsed = sorted[0].elapsed

      context.picked = sorted.filter(it => it.elapsed - minElapsed < largeLatencyThreshold)

      if (context.picked.length === 1) {
        context.selected = context.picked[0]
      }

      return context
    }
  }
}

function closePeersScoreLink({ closePeersDistance, latencyDeductionsParameters }: ClosePeersScoreParameters): AlgorithmLink {
  function closeUsersScore(currentParcel: Parcel) {
    return (candidate: Candidate) => {
      const parcels = usersParcels(candidate)
      if (parcels) {
        return countParcelsCloseTo(currentParcel, parcels, 4)
      } else return 0
    }
  }

  return {
    name: AlgorithmLinkTypes.CLOSE_PEERS_SCORE,
    pick: (context: AlgorithmContext) => {
      const score = memoizedScores(closeUsersScore(context.userParcel))
      return selectFirstByScore(context, score)
    }
  }
}

function loadBalancingLink(): AlgorithmLink {
  return {
    name: AlgorithmLinkTypes.LOAD_BALANCING,
    pick: (context: AlgorithmContext) => {
      const usersByDomain: Record<string, number> = {}
      context.picked.forEach((it) => {
        if (!usersByDomain[it.domain]) {
          usersByDomain[it.domain] = 0
        }

        usersByDomain[it.domain] += usersCount(it)
      })
    }
  }
}


function buildLink(linkConfig: AlgorithmLinkConfig) {
  switch (linkConfig.type) {
    case AlgorithmLinkTypes.LARGE_LATENCY: {
      return largeLatencyLink({ ...defaultLargeLatencyConfig, ...linkConfig.config })
    }
    case AlgorithmLinkTypes.CLOSE_PEERS_SCORE: {
      return closePeersScoreLink({
        ...defaultClosePeersScoreConfig, ...linkConfig.config,
        latencyDeductionsParameters: { ...defaultClosePeersScoreConfig.latencyDeductionsParameters, ...linkConfig.config?.latencyDeductionsParameters }
      })
    }
    case AlgorithmLinkTypes.ALL_PEERS_SCORE: {
      return allUsersScoreLink({
        ...defaultAllPeersScoreConfig, ...linkConfig.config,
        latencyDeductionsParameters: { ...defaultAllPeersScoreConfig.latencyDeductionsParameters, ...linkConfig.config?.latencyDeductionsParameters }
      })
    }
    case AlgorithmLinkTypes.LOAD_BALANCING: {
      return loadBalancingLink()
    }
  }
}

function buildChain(config: AlgorithmChainConfig) {
  return config.map(linkConfig => {
    const link = buildLink(linkConfig)

    if (linkConfig.name) {
      link.name = linkConfig.name
    }

    return link
  })
}


export function createAlgorithm(config: AlgorithmChainConfig) {
  const chain: AlgorithmLink[] = buildChain(config)

  return {
    pickRealm(candidates: Candidate[], userParcel: Parcel) {
      if (candidates.length === 0) throw new Error("Cannot pick candidates from an empty list")

      let context: AlgorithmContext = { allCandidates: candidates, picked: candidates, userParcel }

      for (const link of chain) {
        context = link.pick(context)

        // If a link picks a particular candidate, we return that
        if (context.selected) {
          return context.selected
        }
      }

      // If all the links have gone through, and we don't have a clear candidate, we pick the first
      if (context.picked[0]) return context.picked[0]

      throw new Error("No candidate could be picked using the configured algorithm: " + JSON.stringify(config))
    }
  }
}