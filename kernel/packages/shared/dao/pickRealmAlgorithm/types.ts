
export enum AlgorithmLinkTypes {
  LARGE_LATENCY = 'LARGE_LATENCY',
  CLOSE_PEERS_SCORE = 'CLOSE_PEERS_SCORE',
  ALL_PEERS_SCORE = 'ALL_PEERS_SCORE',
  LOAD_BALANCING = 'LOAD_BALANCING',
}

export type LargeLatencyConfig = {
  type: AlgorithmLinkTypes.LARGE_LATENCY
  config?: { largeLatencyThreshold: number }
}

export type LargeLatencyParameters = LargeLatencyConfig['config']

export type ClosePeersScoreConfig = {
  type: AlgorithmLinkTypes.CLOSE_PEERS_SCORE
  config?: {
    /**
     * Distance in parcels to which a peer is considered close, so it can count for the score.
     */
    closePeersDistance?: number,
    baseScore?: number,
    latencyDeductionsParameters?: LatencyDeductionsConfig
  }
}

/**
 * Score deduced by latency, equivalent to users. This responds to the following formula: m * (e ^ (x / c) - 1)
 * Where m is the multiplier, e is Euler's number, x is the latency and c is the exponencialDivisor. 
 * See here for a visualization of the formula: https://www.desmos.com/calculator/7iiz4njm26
 * By default, these values are 60 for the multiplier, and 700 for the divisor, resulting, for example, in the following values:
 * 
 * | latency | deduction |
 * | ------- | --------- |
 * | 500     | 62        |
 * | 750     | 115       |
 * | 1000    | 190       |
 * | 1250    | 300       |
 * | 1500    | 451       |
 * | 1750    | 670       |
 * | 2000    | 984       |
 * 
 * If a maxDeduction is provided, then no more than that number of users will be deduced from the score.
 */
export type LatencyDeductionsConfig = {
  multiplier?: number
  exponentialDivisor?: number
  maxDeduction?: number
}

export type LatencyDeductionsParameters = Required<LatencyDeductionsConfig>

export type ClosePeersScoreParameters = Required<ClosePeersScoreConfig['config']> & {
  latencyDeductionsParameters: LatencyDeductionsParameters
}

export type LoadBalancingConfig = {
  type: AlgorithmLinkTypes.LOAD_BALANCING
}

export type AllPeersScoreConfig = {
  type: AlgorithmLinkTypes.ALL_PEERS_SCORE,
  config?: {
    /** Base score for any realm that has at least 1 user. Default: 40 */
    baseScore?: number,
    /** If the realm has maxUsers, the score will rise only until the target percentage of fullness represented by this value is reached */
    fillTargetPercentage?: number
    /** If the realm has maxUsers, the score will become baseScore when this percentage is reached*/
    discourageFillTargetPercentage?: number
    latencyDeductionsParameters?: LatencyDeductionsConfig
  }
}

export type AllPeersScoreParameters = Required<AllPeersScoreConfig['config']> & {
  latencyDeductionsParameters: Required<LatencyDeductionsConfig>
}

export type AlgorithmLinkConfig = (LargeLatencyConfig | AllPeersScoreConfig | ClosePeersScoreConfig | LoadBalancingConfig) & { name?: string }

export type AlgorithmChainConfig = AlgorithmLinkConfig[]