import { DEBUG_MESSAGES } from 'config'
import future from 'fp-future'
import { createLogger } from 'shared/logger'
import type { CommonRendererOptions } from './loader'
import type { UnityGame } from '@dcl/unity-renderer/src/index'
import { globalObservable } from 'shared/observables'

const logger = createLogger('ws-adapter: ')

/** This connects the local game to a native client via WebSocket */
export async function initializeUnityEditor(
  webSocketUrl: string,
  container: HTMLElement,
  options: CommonRendererOptions
): Promise<UnityGame> {
  const engineStartedFuture = future<UnityGame>()

  let firstConnect = true
  let errorState = false

  const connect = () => {
    logger.info(`Connecting WS to ${webSocketUrl}`)
    container.innerHTML = `<h3>Connecting...</h3>`
    const ws = new WebSocket(webSocketUrl)

    globalObservable.on('error', (_error) => {
      errorState = true
      ws.close()
    })

    ws.onclose = function (e) {
      if (firstConnect === false) {
        logger.error('WS closed!', e)
        if (errorState === false) {
          location.reload()
          container.innerHTML = `<h3 style='color:red'>Disconnected</h3>`
        } else {
          container.innerHTML = ``
        }
      }
    }

    ws.onerror = function (e) {
      if (firstConnect) {
        setTimeout(function () {
          connect()
        }, 1000)
      } else {
        logger.error('WS error!', e)
        container.innerHTML = `<h3 style='color:red'>EERRORR</h3>`
        engineStartedFuture.reject(new Error('Error in transport'))
      }
    }

    ws.onmessage = function (ev) {
      if (DEBUG_MESSAGES) {
        logger.info('>>>', ev.data)
      }

      try {
        const m = JSON.parse(ev.data)
        if (m.type && m.payload) {
          options.onMessage(m.type, m.payload)
        } else {
          logger.error('Unexpected message: ', m)
        }
      } catch (e) {
        logger.error(e)
      }
    }

    const gameInstance: UnityGame = {
      Module: {},
      SendMessage(_obj, type, payload) {
        if (ws.readyState === ws.OPEN) {
          const msg = JSON.stringify({ type, payload })
          ws.send(msg)
        }
      },
      SetFullscreen() {
        // stub
      },
      async Quit() {
        // stub
      }
    }

    ws.onopen = function () {
      firstConnect = false
      container.classList.remove('dcl-loading')
      logger.info('WS open!')
      gameInstance.SendMessage('', 'Reset', '')
      container.innerHTML = `<h3 style='color:green'>Connected</h3>`
      // @see packages/shared/renderer/sagas.ts
      engineStartedFuture.resolve(gameInstance)
    }
  }

  connect()

  return engineStartedFuture
}
