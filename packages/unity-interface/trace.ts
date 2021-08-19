import { UnityGame } from '@dcl/unity-renderer/src'
import { TRACE_RENDERER } from 'config'
import { CommonRendererOptions } from './loader'

let pendingMessagesInTrace = 0
let currentTrace: string[] = []

export function traceDecoratorRendererOptions(options: CommonRendererOptions): CommonRendererOptions {
  const originalOnMessage = options.onMessage

  return {
    ...options,
    onMessage(type, payload) {
      if (pendingMessagesInTrace > 0) {
        logTrace(type, payload, 'RK')
      }
      return originalOnMessage.call(options, type, payload)
    }
  }
}

export function traceDecoratorUnityGame(game: UnityGame): UnityGame {
  const originalSendMessage = game.SendMessage
  game.SendMessage = function (obj, method, args) {
    if (pendingMessagesInTrace > 0) {
      logTrace(`${obj}.${method}`, args, 'KR')
    }
    return originalSendMessage.call(this, obj, method, args)
  }
  return game
}

export function beginTrace(number: number) {
  if (number > 0) {
    currentTrace.length = 0
    pendingMessagesInTrace = number
    console.log('[TRACING] Beginning trace')
  }
}

/**
 * RK: Renderer->Kernel
 * KR: Kernel->Renderer
 * KK: Kernel->Kernel
 */
export function logTrace(type: string, payload: string | number, direction: 'RK' | 'KR' | 'KK') {
  if (pendingMessagesInTrace > 0) {
    const now = performance.now().toFixed(1)
    if (direction === 'KK') {
      try {
        currentTrace.push(`${direction}\t${now}\t${JSON.stringify(type)}\t${JSON.stringify(payload)}`)
      } catch (e) {
        currentTrace.push(`${direction}\t${now}\t${JSON.stringify(type)}\tCIRCULAR`)
      }
    } else {
      currentTrace.push(
        `${direction}\t${now}\t${JSON.stringify(type)}\t${
          payload === undefined ? '' : payload.toString().replace(/\n/g, '\\n')
        }`
      )
    }
    pendingMessagesInTrace--
    if (pendingMessagesInTrace % 11 == 0) {
      console.log('[TRACING] Pending messages to download: ' + pendingMessagesInTrace)
    }
    if (pendingMessagesInTrace == 0) {
      finishTrace()
    }
  }
}

function finishTrace() {
  pendingMessagesInTrace = 0
  const content = currentTrace.join('\n')
  let file = new File([content], 'decentraland-trace.csv', { type: 'text/csv' })
  let exportUrl = URL.createObjectURL(file)
  console.log('[TRACING] Ending trace, downloading file: ', exportUrl, ' check your downloads folder.')
  window.location.assign(exportUrl)
  currentTrace.length = 0
}

;(globalThis as any).beginTrace = beginTrace

const parametricTrace = parseInt(TRACE_RENDERER || '0', 10)
if (!isNaN(parametricTrace) && parametricTrace > 0) {
  beginTrace(parametricTrace)
}
