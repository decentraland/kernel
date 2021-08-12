import { Candidate } from "../types"
import { defaultClosePeersScoreConfig, defaultLargeLatencyConfig } from "./defaults"
import { AlgorithmChainConfig, AlgorithmLinkConfig, AlgorithmLinkTypes, ClosePeersScoreParameters, LargeLatencyConfig, LargeLatencyParameters } from "./types"

/**
 * The allCandidates attribute lists all candidates. The "picked" candidates is a sorted list of those candidates picked by all the previous links
 */
type AlgorithmContext = { allCandidates: Candidate[], picked: Candidate[], scores: Map<Candidate, number> }


type AlgorithmLink = {
  name: string,
  pick: (context: AlgorithmContext) => AlgorithmContext
}

function scoreLink(): AlgorithmLink {
  function getOrCalculateScore(candidate: Candidate, scores: Map<Candidate, number>) {
    if (!scores.has(candidate)) {
      scores.set(candidate, score(candidate))
    }

    return scores.get(candidate)
  }

  function usersScore(candidate: Candidate) {
    const usersCount = candidate.type === 'layer-based' ? candidate.layer.usersCount : candidate.usersCount
    const maxUsers = candidate.type === 'layer-based' ? candidate.layer.maxUsers : candidate.maxUsers

    // We prefer realms that have users
    if (usersCount === 0) return 0

    const baseScore = 40

    const linearUsersScore = (users: number) => baseScore + users

    if (maxUsers) {
      if (usersCount >= maxUsers) return -baseScore // A full realm has negative score. They should've been filtered before, but you never know

      // We try to fill all realms until around 75%
      if (usersCount >= 0.4 * maxUsers) {
        // We calculate a segment joining the 40% filled linear score with baseScore at 75% maxUsers
        const segment = { a: { x: 0.4 * maxUsers, y: linearUsersScore(0.4 * maxUsers) }, b: { x: 0.75 * maxUsers, y: baseScore } }

        const slope = (segment.b.y - segment.a.y) / (segment.b.x - segment.a.x)

        // The score is the result of calculating the corresponding point of this segment at usersCount
        return segment.a.y + slope * (usersCount - segment.a.x)
      }
    } else {
      return linearUsersScore(usersCount)
    }
  }

  function latencyDeductions(candidate: Candidate) {
    //TODO
    return 0
  }

  function score(candidate: Candidate) {
    const scoreByUsers = usersScore(candidate)

    return scoreByUsers - latencyDeductions(candidate)
  }

  return {
    name: 'SCORE',
    pick: (context: AlgorithmContext) => {
      const sorted = context.picked.sort((a, b) => a.elapsed - b.elapsed)

      const minElapsed = sorted[0].elapsed

      context.picked = sorted.filter(it => it.elapsed - minElapsed < largeLatencyThreshold)

      return context
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

      return context
    }
  }
}

function closePeersScoreLink({ closePeersDistance, latencyDeductionsParameters }: ClosePeersScoreParameters): AlgorithmLink {
  return {
    name: AlgorithmLinkTypes.CLOSE_PEERS_SCORE,
    pick: (context: AlgorithmContext) => {
      return context
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


export async function createAlgorithm(config: AlgorithmChainConfig) {
  const chain: AlgorithmLink[] = buildChain(config)

  return {
    pickRealm(candidates: Candidate[]) {
      if (candidates.length === 0) throw new Error("Cannot pick candidates from an empty list")

    }
  }
}