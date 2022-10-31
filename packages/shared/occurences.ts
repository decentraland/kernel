const occurrencesCounter = new Map<Counters, number>()

export type Counters =
  | 'pong_duplicated_response_counter'
  | 'pong_expected_counter'
  | 'pong_given_counter'
  | 'failed:sendPositionMessage'
  | `commMessage:${string}`
  | `setThrew:${string}`
  | 'voiceChatHandlerError'
  | 'voiceChatRequestMediaDeviceFail'
  | 'ping_sent_counter'
  | 'pong_sent_counter'
  | 'pong_received_counter'
  | 'ping_received_twice_counter'
  | 'profile-over-comms-succesful'
  | 'profile-over-comms-failed'

export function incrementCounter(counter: Counters, by = 1) {
  occurrencesCounter.set(counter, (occurrencesCounter.get(counter) || 0) + by)
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
