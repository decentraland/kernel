import { countParcelsCloseTo } from "../../comms/interface/utils"
import { Parcel, Candidate } from "../types"
import { ClosePeersScoreParameters, AlgorithmLink, AlgorithmLinkTypes, AlgorithmContext } from "./types"
import { usersParcels, memoizedScores, scoreUsingLatencyDeductions, selectFirstByScore } from "./utils"

export function closePeersScoreLink({ closePeersDistance, latencyDeductionsParameters }: ClosePeersScoreParameters): AlgorithmLink {
  function closeUsersScore(currentParcel: Parcel) {
    return (candidate: Candidate) => {
      const parcels = usersParcels(candidate)
      if (parcels) {
        return countParcelsCloseTo(currentParcel, parcels, closePeersDistance)
      } else return 0
    }
  }

  return {
    name: AlgorithmLinkTypes.CLOSE_PEERS_SCORE,
    pick: (context: AlgorithmContext) => {
      const score = memoizedScores(scoreUsingLatencyDeductions(latencyDeductionsParameters, closeUsersScore(context.userParcel)))
      return selectFirstByScore(context, score)
    }
  }
}
