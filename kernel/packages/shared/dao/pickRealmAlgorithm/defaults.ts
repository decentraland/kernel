import { ClosePeersScoreConfig, LargeLatencyConfig } from "./types";

export const defaultLargeLatencyConfig: LargeLatencyConfig['config'] = {
  largeLatencyThreshold: 3500
}

export const defaultClosePeersScoreConfig: Required<ClosePeersScoreConfig['config'] & { latencyDeductionsParameters: Required<ClosePeersScoreConfig['config']['latencyDeductionsParameters']> }> = {
  closePeersDistance: 6,
  latencyDeductionsParameters: {
    exponentialDivisor: 700,
    multiplier: 60,
    maxDeduction: 10000
  }
}