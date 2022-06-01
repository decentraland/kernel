export type Stat = {
  repeatCount: number
  repeatBytesCount: number
  nextTick: number
}

export type StatId = 'sendBatch' | 'eventReceive'

const stats: Map<StatId, Stat> = new Map<StatId, Stat>()

let onLog: ((...args: any[]) => void) | null = null
export function setupStats(newOnLog: (...args: any[]) => void) {
  onLog = newOnLog
}

export function addStat(id: StatId, count: number, byteLength: number) {
  const now = new Date().getTime()
  if (!stats.has(id)) {
    stats.set(id, {
      repeatBytesCount: 0,
      repeatCount: 0,
      nextTick: new Date().getTime() + 1000
    })
    if (onLog) onLog(`[new-rpc-stat] ${id} initialized`)
  }

  const stat = stats.get(id)!
  if (now > stat.nextTick) {
    const dt = 1000 + now - stat.nextTick
    if (onLog) onLog(`[new-rpc-stat] ${id} - count ${stat.repeatCount} - bytes ${stat.repeatBytesCount} in ${dt}ms`)
    stat.repeatCount = stat.repeatBytesCount = 0
    stat.nextTick = now + 1000
  }
  stat.repeatCount += count
  stat.repeatBytesCount += byteLength
}
