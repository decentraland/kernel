import { WebWorkerTransport } from 'decentraland-rpc'
import { inject } from 'decentraland-rpc/lib/client/Script'
import { defaultLogger } from 'shared/logger'
import { RunOptions, SceneRuntime } from './sdk/SceneRuntime'
import { DevToolsAdapter } from './sdk/DevToolsAdapter'
import { ScriptingTransport } from 'decentraland-rpc/lib/common/json-rpc/types'

import { run as runWasm } from '@dcl/wasm-runtime'
import { CHANNELS } from '@dcl/wasm-runtime/dist/io/fs'
import { IChannel } from '@dcl/wasm-runtime/dist/io/IChannel'

/**
 * This file starts the scene in a WebWorker context.
 */

class WebWorkerScene extends SceneRuntime {
  @inject('DevTools')
  devTools: any

  devToolsAdapter?: DevToolsAdapter

  updateEnabled: boolean = true

  constructor(transport: ScriptingTransport) {
    super(transport)

    addEventListener('error', (e) => {
      console.warn('🚨🚨🚨 Unhandled error in scene code. Disabling worker update loop 🚨🚨🚨')
      console.error(e)
      this.updateEnabled = false
      eval('debu' + 'gger')
      e.preventDefault() // <-- "Hey browser, I handled it!"
      if (this.devToolsAdapter) this.devToolsAdapter.error(e.error)
    })
  }

  async run({ sourceResponse, isWasmScene, dcl }: RunOptions): Promise<void> {
    let wasmBytes: Uint8Array
    if (isWasmScene) {
      wasmBytes = new Uint8Array(await sourceResponse.arrayBuffer())
    } else {
      const quickJsWasmURL =
        'https://sdk-team-cdn.decentraland.org/@dcl/wasm-quickjs-loader/branch/feat/organize-project/loader.wasm'
      const quicksJSLoaderWasm = await (await fetch(quickJsWasmURL)).arrayBuffer()
      wasmBytes = new Uint8Array(quicksJSLoaderWasm)
    }

    const result = await runWasm({ wasmBytes, memoryDescriptor: { initial: 100, maximum: 500 } })
    const rendererChannel = result.metaverseWrapper.channels.get(CHANNELS.RENDERER.KEY) as IChannel

    if (!isWasmScene) {
      result.metaverseWrapper.wasmFs.fs.writeFileSync('/game.js', await sourceResponse.text())
    }

    const enc = new TextEncoder()

    rendererChannel.setDataArriveCallback((data: Uint8Array) => {
      try {
        const msg: { method: string; params: any[]; promiseId?: number } = JSON.parse(
          Buffer.from(data).toString('utf8')
        )
        const result = (dcl as any)[msg.method].apply(dcl, msg.params)

        if (msg.promiseId !== 0 && result instanceof Promise) {
          console.log(`Scene->Kernel: resolving promise ${msg.promiseId}`)
          result
            .then((returnedObject) => {
              console.log(`Scene->Kernel: promise resolve ${msg.promiseId}`, returnedObject)
              const response = JSON.stringify({ promiseId: msg.promiseId, resolved: true, data: returnedObject })
              rendererChannel.writeMessage(enc.encode(response))
            })
            .catch((returnedError) => {
              console.log(`Scene->Kernel: promise error ${msg.promiseId}`, returnedError)
              const response = JSON.stringify({ promiseId: msg.promiseId, resolved: false, data: returnedError })
              rendererChannel.writeMessage(enc.encode(response))
            })
        } else {
          console.log(`Scene->Kernel: call ${msg.method} with `, msg.params, ` pid:${msg.promiseId} result `, result)
        }
      } catch (err) {
        console.error(err, Buffer.from(data).toString('utf8'))
      }
    })

    await result.start()
    this.onUpdateFunctions.push((dt: number) => {
      result.update(dt)
    })
    this.onEventFunctions.push((event: any) => {
      const response = JSON.stringify({ event })
      rendererChannel.writeMessage(enc.encode(response))
    })
  }

  async systemDidEnable() {
    this.devToolsAdapter = new DevToolsAdapter(this.devTools)
    await super.systemDidEnable()
  }

  onError(error: Error) {
    if (this.devToolsAdapter) {
      this.devToolsAdapter.error(error)
    } else {
      defaultLogger.error('', error)
    }
  }

  onLog(...messages: any[]) {
    if (this.devToolsAdapter) {
      this.devToolsAdapter.log(...messages)
    } else {
      defaultLogger.info('', ...messages)
    }
  }

  startLoop() {
    let start = performance.now()

    const update = () => {
      if (!this.updateEnabled) return

      const now = performance.now()
      const dt = now - start
      start = now

      setTimeout(update, this.updateInterval)

      const time = dt / 1000

      this.update(time)
    }

    update()
  }
}

// tslint:disable-next-line
new WebWorkerScene(WebWorkerTransport(self))
