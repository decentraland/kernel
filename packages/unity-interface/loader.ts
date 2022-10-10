import future from 'fp-future'
import type * as _TheRenderer from '@dcl/unity-renderer/src/index'
import { trackEvent } from 'shared/analytics'
import { BringDownClientAndShowError } from 'shared/loading/ReportFatalError'

declare const globalThis: { DclRenderer?: DclRenderer }

export type DclRenderer = typeof _TheRenderer

export type LoadRendererResult = {
  DclRenderer: DclRenderer
  baseUrl: string
  createWebRenderer(canvas: HTMLCanvasElement): Promise<_TheRenderer.DecentralandRendererInstance>
}

/**
 * The following options are common to all kinds of renderers, it abstracts
 * what we need to implement in our end to support a renderer. WIP
 */
export type CommonRendererOptions = {
  onMessage: (type: string, payload: string) => void
}

function extractSemver(url: string): string | null {
  const r = url.match(/([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+)?/)

  if (r) {
    return r[0]
  }

  return null
}

export async function loadUnity(baseUrl: string, options: CommonRendererOptions): Promise<LoadRendererResult> {
  const rendererVersion = extractSemver(baseUrl) || 'dynamic'

  const scriptUrl = new URL('index.js', baseUrl).toString()

  window['console'].log('Renderer: ' + scriptUrl)

  let startTime = performance.now()

  trackEvent('unity_loader_downloading_start', { renderer_version: rendererVersion })
  await injectScript(scriptUrl)
  trackEvent('unity_loader_downloading_end', {
    renderer_version: rendererVersion,
    loading_time: performance.now() - startTime
  })

  if (typeof globalThis.DclRenderer === 'undefined') {
    throw new Error('Error while loading the renderer from ' + scriptUrl)
  }

  if (typeof (globalThis.DclRenderer.initializeWebRenderer as any) === 'undefined') {
    throw new Error(
      'This version of explorer is only compatible with renderers newer than https://github.com/decentraland/unity-renderer/pull/689'
    )
  }

  return {
    DclRenderer: globalThis.DclRenderer,
    createWebRenderer: async (canvas) => {
      let didLoadUnity = false

      startTime = performance.now()
      trackEvent('unity_downloading_start', { renderer_version: rendererVersion })

      function onProgress(progress: number) {
        // 0.9 is harcoded in unityLoader, it marks the download-complete event
        if (0.9 === progress && !didLoadUnity) {
          trackEvent('unity_downloading_end', {
            renderer_version: rendererVersion,
            loading_time: performance.now() - startTime
          })

          startTime = performance.now()
          trackEvent('unity_initializing_start', { renderer_version: rendererVersion })
          didLoadUnity = true
        }
        // 1.0 marks the engine-initialized event
        if (1.0 === progress) {
          trackEvent('unity_initializing_end', {
            renderer_version: rendererVersion,
            loading_time: performance.now() - startTime
          })
        }
      }

      return globalThis.DclRenderer!.initializeWebRenderer({
        baseUrl,
        canvas,
        versionQueryParam: rendererVersion === 'dynamic' ? Date.now().toString() : rendererVersion,
        onProgress,
        onMessageLegacy: options.onMessage,
        onError: (error) => {
          BringDownClientAndShowError(error)
        },
        onBinaryMessage: (...args) => {
          console.log('onBinaryMessage', ...args)
        },
        extraConfig: {
          antialias: false,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: true
        }
      })
    },
    baseUrl
  }
}

async function injectScript(url: string) {
  const theFuture = future<Event>()
  const theScript = document.createElement('script')
  const persistMessage =
    'If this error persists, please try emptying the cache of your browser and reloading this page.'
  theScript.src = url
  theScript.async = true
  theScript.type = 'application/javascript'
  theScript.crossOrigin = 'anonymous'
  theScript.addEventListener('load', theFuture.resolve)
  theScript.addEventListener('error', (e) =>
    theFuture.reject(e.error || new Error(`The script ${url} failed to load.\n${persistMessage}`))
  )
  theScript.addEventListener('abort', () =>
    theFuture.reject(
      new Error(
        `Script loading aborted: ${url}.\nThis may be caused because you manually stopped the loading or because of a network error.\n${persistMessage}`
      )
    )
  )
  document.body.appendChild(theScript)
  return theFuture
}
