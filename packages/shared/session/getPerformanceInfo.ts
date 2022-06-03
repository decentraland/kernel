import { getUsedComponentVersions } from 'shared/rolloutVersions'

let kernelToRendererMessageCounter = 0
let rendererToKernelMessageCounter = 0
let receivedCommsMessagesCounter = 0
let sentCommsMessagesCounter = 0
let kernelToRendererMessageNativeCounter = 0

export function incrementMessageFromRendererToKernel() {
  rendererToKernelMessageCounter++
}

export function incrementMessageFromKernelToRenderer() {
  kernelToRendererMessageCounter++
}

export function incrementMessageFromKernelToRendererNative() {
  kernelToRendererMessageNativeCounter++
}

export function incrementCommsMessageReceived() {
  receivedCommsMessagesCounter++
}

export function incrementCommsMessageSent() {
  sentCommsMessagesCounter++
}

export function getPerformanceInfo(data: {
  samples: string
  fpsIsCapped: boolean
  hiccupsInThousandFrames: number
  hiccupsTime: number
  totalTime: number
}) {
  const entries: number[] = []
  const length = data.samples.length
  let sum = 0
  for (let i = 0; i < length; i++) {
    entries[i] = data.samples.charCodeAt(i)
    sum += entries[i]
  }
  const sorted = entries.sort((a, b) => a - b)

  const runtime = performance.now()

  const memory = (performance as any).memory

  const jsHeapSizeLimit = memory?.jsHeapSizeLimit
  const totalJSHeapSize = memory?.totalJSHeapSize
  const usedJSHeapSize = memory?.usedJSHeapSize

  const isHidden = (globalThis as any).document?.hidden

  const { kernelVersion, rendererVersion } = getUsedComponentVersions()

  const ret = {
    runtime,
    idle: isHidden,
    fps: (1000 * length) / sum,
    avg: sum / length,
    total: sum,
    len: length,
    min: sorted[0],
    p1: sorted[Math.ceil(length * 0.01)],
    p5: sorted[Math.ceil(length * 0.05)],
    p10: sorted[Math.ceil(length * 0.1)],
    p20: sorted[Math.ceil(length * 0.2)],
    p50: sorted[Math.ceil(length * 0.5)],
    p75: sorted[Math.ceil(length * 0.75)],
    p80: sorted[Math.ceil(length * 0.8)],
    p90: sorted[Math.ceil(length * 0.9)],
    p95: sorted[Math.ceil(length * 0.95)],
    p99: sorted[Math.ceil(length * 0.99)],
    max: sorted[length - 1],
    samples: entries.join(','),
    // chrome memory
    jsHeapSizeLimit,
    totalJSHeapSize,
    usedJSHeapSize,
    // flags
    capped: data.fpsIsCapped,
    // hiccups
    hiccupsInThousandFrames: data.hiccupsInThousandFrames,
    hiccupsTime: data.hiccupsTime,
    totalTime: data.totalTime,
    // counters
    kernelToRendererMessageCounter,
    rendererToKernelMessageCounter,
    receivedCommsMessagesCounter,
    sentCommsMessagesCounter,
    kernelToRendererMessageNativeCounter,
    // versions
    kernelVersion,
    rendererVersion
  }

  sentCommsMessagesCounter = 0
  receivedCommsMessagesCounter = 0
  kernelToRendererMessageCounter = 0
  rendererToKernelMessageCounter = 0
  kernelToRendererMessageNativeCounter = 0

  return ret
}
