import { Candidate } from "../types"
import { AlgorithmContext, LatencyDeductionsParameters } from "./types"

export function usersCount(candidate: Candidate) {
  return candidate.type === 'layer-based' ? candidate.layer.usersCount : candidate.usersCount
}

export function maxUsers(candidate: Candidate) {
  return candidate.type === 'layer-based' ? candidate.layer.maxUsers : candidate.maxUsers
}

export function usersParcels(candidate: Candidate) {
  return candidate.type === 'layer-based' ? candidate.layer.usersParcels : candidate.usersParcels
}

export function memoizedScores(scoreFunction: (c: Candidate) => number) {
  const scores = new Map<Candidate, number>()
  return (candidate: Candidate) => {
    if (!scores.has(candidate)) {
      scores.set(candidate, scoreFunction(candidate))
    }

    return scores.get(candidate)!
  }
}

export function latencyDeductions(candidate: Candidate, { multiplier, exponentialDivisor, maxDeduction }: LatencyDeductionsParameters) {
  const expResult = multiplier * (Math.exp(candidate.elapsed / exponentialDivisor) - 1)
  return Math.min(expResult, maxDeduction)
}

export function scoreUsingLatencyDeductions(parameters: LatencyDeductionsParameters, baseScoreFunction: (c: Candidate) => number) {
  return (candidate: Candidate) => {
    const scoreByUsers = baseScoreFunction(candidate)

    return scoreByUsers - latencyDeductions(candidate, parameters)
  }
}

export function selectFirstByScore(context: AlgorithmContext, score: (c: Candidate) => number) {
  const compareFn = (a: Candidate, b: Candidate) => score(b) - score(a)

  return selectFirstBy(context, compareFn)
}

export function selectFirstBy(context: AlgorithmContext, compareFn: (a: Candidate, b: Candidate) => number) {
  const sorted = context.picked.sort(compareFn)

  context.picked = sorted

  if (context.picked.length === 1 || compareFn(context.picked[0], context.picked[1]) < 0) {
    context.selected = context.picked[0]
  }

  return context
}