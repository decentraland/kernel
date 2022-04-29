import { PREVIEW } from 'config'
import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'
import { ExposableAPI } from './ExposableAPI'
import { ParcelIdentity } from './ParcelIdentity'

@registerAPI('ExperimentalAPI')
export class ExperimentalAPI extends ExposableAPI {
  sceneId = this.options.getAPIInstance(ParcelIdentity).cid

  @exposeMethod
  async sendToRenderer(dataStr: string): Promise<void> {
    if (!PREVIEW) return

    const data = Buffer.from(dataStr, 'base64')
    console.log({ sceneId: this.sceneId, data })
  }
}
