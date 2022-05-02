import { PREVIEW } from 'config'
import { registerAPI, exposeMethod, APIOptions } from 'decentraland-rpc/lib/host'
import defaultLogger from 'shared/logger'
import { ExposableAPI } from './ExposableAPI'
import { ParcelIdentity } from './ParcelIdentity'

type ExperimentalMetrics = {
  intervalId: number
  byteAmount: number
  chunksAmount: number
  withoutUpdates: boolean
}

@registerAPI('ExperimentalAPI')
export class ExperimentalAPI extends ExposableAPI {
  sceneId = this.options.getAPIInstance(ParcelIdentity).cid
  metrics: ExperimentalMetrics

  constructor(options: APIOptions) {
    super(options)
    this.metrics = {
      intervalId: setInterval(() => {
        const metrics = this.metrics
        if (metrics.byteAmount === 0) {
          if (metrics.withoutUpdates) {
            return
          } else {
            metrics.withoutUpdates = true
            defaultLogger.info('NewECS::sendToRenderer', 'There were no chunks at the last second.')
          }
        } else {
          const byteAveragePerChunk = metrics.byteAmount / Math.min(1, metrics.chunksAmount)
          defaultLogger.info('NewECS::sendToRenderer', {
            sceneId: this.sceneId,
            ...metrics,
            byteAveragePerChunk
          })
        }

        metrics.withoutUpdates = false
        metrics.byteAmount = 0
        metrics.chunksAmount = 0
      }, 1000) as any,
      byteAmount: 0,
      chunksAmount: 0,
      withoutUpdates: false
    }
  }

  @exposeMethod
  async sendToRenderer(dataStr: string): Promise<void> {
    if (!PREVIEW) return

    const data = Buffer.from(dataStr, 'base64')
    this.metrics.byteAmount += data.byteLength
    this.metrics.chunksAmount += 1

    // TODO: send the data to the renderer!
  }
}
