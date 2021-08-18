import { AlgorithmChainConfig, AlgorithmLinkTypes, AllPeersScoreParameters, ClosePeersScoreParameters, LargeLatencyParameters } from "./types"

export const defaultLargeLatencyConfig: LargeLatencyParameters = {
  largeLatencyThreshold: 3500
}

export const defaultClosePeersScoreConfig: ClosePeersScoreParameters = {
  baseScore: 40,
  closePeersDistance: 6,
  latencyDeductionsParameters: {
    exponentialDivisor: 700,
    multiplier: 60,
    maxDeduction: 10000
  }
}

export const defaultAllPeersScoreConfig: AllPeersScoreParameters = {
  baseScore: 40,
  fillTargetPercentage: 0.5,
  discourageFillTargetPercentage: 0.8,
  latencyDeductionsParameters: {
    exponentialDivisor: 1500,
    multiplier: 50,
    maxDeduction: 1000
  }
}

export const defaultChainConfig: AlgorithmChainConfig = [
  { type: AlgorithmLinkTypes.LARGE_LATENCY },
  { type: AlgorithmLinkTypes.CLOSE_PEERS_SCORE },
  { type: AlgorithmLinkTypes.ALL_PEERS_SCORE },
  { type: AlgorithmLinkTypes.LOAD_BALANCING }
]
