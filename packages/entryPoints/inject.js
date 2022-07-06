globalThis.global = globalThis
globalThis.Buffer = require('buffer').Buffer
globalThis.process = {
  browser: true,
  env: {},
  nextTick(fn, ...args) {
    require('queue-microtask')(() => fn(...args))
  }
}
