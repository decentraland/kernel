import { WebWorkerTransport } from 'decentraland-rpc'
import { inject } from 'decentraland-rpc/lib/client/Script'
import { defaultLogger } from 'shared/logger'
import { RunOptions, SceneRuntime } from './sdk/SceneRuntime'
import { DevToolsAdapter } from './sdk/DevToolsAdapter'
import { ScriptingTransport } from 'decentraland-rpc/lib/common/json-rpc/types'

import { run as runWasm } from '@dcl/wasm-runtime'
// import { rendererAdapter } from './sdk/RendererAdapter'
import { CHANNELS } from '@dcl/wasm-runtime/dist/io/fs'
import { IChannel } from '@dcl/wasm-runtime/dist/io/IChannel'

// const quickJsLoader = require('@dcl/wasm-quickjs-loader/dist/index.js')
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
    // const myRndMs= Math.random() * 10000 + 2000
    // console.log(`Scene in position ${this.scenePosition} will delay ${myRndMs}ms`)
    // await new Promise(resolve => setTimeout(resolve, myRndMs))

    // debugger
    
    let wasmBytes: Uint8Array
    if (isWasmScene) {
      wasmBytes = new Uint8Array(await sourceResponse.arrayBuffer())
    } else {
      const quicksJSLoaderWasmRequest = await fetch('http://192.168.0.16:7666/loader.wasm')
      const quicksJSLoaderWasm = await quicksJSLoaderWasmRequest.arrayBuffer()
      wasmBytes = new Uint8Array(quicksJSLoaderWasm)
    }

    const result = await runWasm({ wasmBytes })
    const rendererChannel = result.metaverseWrapper.channels.get(CHANNELS.RENDERER.KEY) as IChannel

    if (!isWasmScene) {
      result.metaverseWrapper.wasmFs.fs.writeFileSync('/game.js', await sourceResponse.text())
    }

    rendererChannel.setDataArriveCallback((data: Uint8Array) => {
      try {
        const msg: {method:string, params:any[]} = JSON.parse(Buffer.from(data).toString('utf8'))
        ;(((dcl as any)[msg.method]) as Function).apply(dcl, msg.params)
        
      } catch(err) {
        console.error(err)
        
      }
      // console.log(`Scene->Kernel: ${data.length} bytes "${Buffer.from(data).toString('utf8')}"`)
    })

    await result.start()

    let counter = 0.0
    this.onUpdateFunctions.push(async (dt: number) => {
      result.update(dt)
      const resultOut = await result.metaverseWrapper.wasmFs.getStdOut()
      if (resultOut) {
        console.log(resultOut)
        await result.metaverseWrapper.wasmFs.fs.writeFileSync('/dev/stdout', '')
      }

      counter += dt
      if (counter > 0.2) {
        counter = 0.0
      }
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
