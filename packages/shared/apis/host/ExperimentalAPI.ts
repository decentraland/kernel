import { PREVIEW } from './../../../config'
import { getUnityInstance } from './../../../unity-interface/IUnityInterface'

import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { ExperimentalAPIServiceDefinition } from '../proto/ExperimentalAPI'
import { PortContext } from './context'

/** @deprecated this is only for experimental purposes */
export function registerExperimentalAPIServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, ExperimentalAPIServiceDefinition, async () => ({
    async sendToRenderer(req, ctx) {
      if (!PREVIEW) return {}
      getUnityInstance().SendBinaryMessage(ctx.EnvironmentAPI.cid, req.data, req.data.byteLength)
      return {}
    },

    async *messageFromRenderer() {}
  }))
}
