import { PREVIEW } from './../../../config'
import { rendererProtocol } from './../../../renderer-protocol/rpcClient'

import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { ExperimentalAPIServiceDefinition } from '../proto/ExperimentalAPI.gen'
import { PortContext } from './context'

/** @deprecated this is only for experimental purposes */
export function registerExperimentalAPIServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, ExperimentalAPIServiceDefinition, async () => ({
    async sendToRenderer(req, ctx) {
      if (!PREVIEW) return {}
      const protocol = await rendererProtocol
      return protocol.crdtService.sendCRDT({ sceneId: ctx.EnvironmentAPI.cid, payload: req.data })
    },

    async *messageFromRenderer() {
      // const protocol = await rendererProtocol
      // for await (const notification of protocol.crdtService.cRDTNotificationStream({})) {
      // }
    }
  }))
}
