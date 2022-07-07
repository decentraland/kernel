// Until chrome fixes their virtual memory problem in which they allocate
// 100GB(virt) to each WASM, we disable WASM in the scene workers
globalThis.WebAssembly.Instance = function () {
  throw new Error('Wasm is not allowed in scene runtimes')
} as any
globalThis.WebAssembly.Module = function () {
  throw new Error('Wasm is not allowed in scene runtimes')
} as any
