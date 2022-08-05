const occurrencesCounter = new Map<string, number>()
export function incrementCounter(counter: string) {
  occurrencesCounter.set(counter, (occurrencesCounter.get(counter) || 0) + 1)
}

export function getAndClearOccurenceCounters() {
  const metrics: Record<string, number> = {}
  let hasMetrics = false
  for (const [key, value] of occurrencesCounter) {
    metrics[key] = value
    hasMetrics = true
  }
  if (hasMetrics) {
    occurrencesCounter.clear()
  }
  return metrics
}
