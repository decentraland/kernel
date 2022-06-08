// limit or not FPS
let fpsCapped = false
// float precision when comparing times affects calculations, "target fps - 10" -> 40 -> 30FPS
let targetFps = 60
let frameMs = 1000 / targetFps
// store a backup of the original requestAnimationFrame just in case
const originalRaf = globalThis.requestAnimationFrame

let instrumented = false

export function setFpsCapOnOff(cap: boolean, fps: number) {
  targetFps = fps + 10
  frameMs = 1000 / targetFps
  fpsCapped = cap

  if (cap && !instrumented) {
    instrumentHackedTimers()
  }
}

setFpsCapOnOff(false, 60)

function instrumentHackedTimers() {
  if (instrumented) return
  instrumented = true

  if (globalThis.requestAnimationFrame && document) {
    // callbacks sent to requestAnimationFrame. The list is cleared once per frame
    let callbacks: FrameRequestCallback[] = []
    let prevTime = 0

    // keep track of the last created handler (raf or timeout) to reschedule a timeout when the document looses visibility
    let lastHandler: number | null = null
    let lastHandlerWasRaf = false

    // called every frame
    function tick(time) {
      lastHandler = null

      if (!fpsCapped || time - prevTime >= frameMs) {
        const oldCallbacks = callbacks
        callbacks = []

        for (let i = 0; i < oldCallbacks.length; i++) {
          oldCallbacks[i](time)
        }

        oldCallbacks.length = 0
        prevTime = time
      }

      scheduleNext()
    }

    function timeoutTick() {
      tick(performance.now())
    }

    function scheduleNext() {
      // if we had a scheduled tick, we cancel it and reschedule again
      if (lastHandler !== null) {
        if (lastHandlerWasRaf) {
          globalThis.cancelAnimationFrame(lastHandler)
        } else {
          clearTimeout(lastHandler)
        }
        lastHandler = null
      }

      // depending on the document visibility, we schedule a setTimeout or rAF
      if (document.hidden) {
        lastHandler = setTimeout(timeoutTick, frameMs) as any
        lastHandlerWasRaf = false
      } else {
        lastHandler = originalRaf(tick)
        lastHandlerWasRaf = true
      }
    }

    globalThis.requestAnimationFrame = function (cb) {
      return callbacks.push(cb)
    }

    // if the document looses visibility, the render loop should keep working. but rAF doesn't
    // We reschedule the next frame, with a setTimeout this time.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        scheduleNext()
      }
    })

    scheduleNext()
  }
}
