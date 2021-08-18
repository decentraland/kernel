import { Candidate } from "../types"
import { AlgorithmContext, AlgorithmLink, AlgorithmLinkTypes, AllPeersScoreParameters } from "./types"
import { usersCount, maxUsers, memoizedScores, scoreUsingLatencyDeductions, selectFirstByScore } from "./utils"

export function allPeersScoreLink({ baseScore, discourageFillTargetPercentage, fillTargetPercentage, latencyDeductionsParameters }: AllPeersScoreParameters): AlgorithmLink {
  function usersScore(candidate: Candidate) {
    const count = usersCount(candidate)
    const max = maxUsers(candidate)

    // We prefer realms that have users. Those will have at least baseScore
    if (count === 0) return 0

    const linearUsersScore = (users: number) => baseScore + users

    if (max) {
      if (count >= max) return -baseScore // A full realm has negative score.

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
    }

    return linearUsersScore(count)
  }

  return {
    name: AlgorithmLinkTypes.ALL_PEERS_SCORE,
    pick: (context: AlgorithmContext) => {
      const score = memoizedScores(scoreUsingLatencyDeductions(latencyDeductionsParameters, usersScore))

      return selectFirstByScore(context, score)
    }
  }
}
