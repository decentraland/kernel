import { rendererProtocol } from './../../../renderer-protocol/rpcClient'

import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { ExperimentalAPIServiceDefinition } from 'shared/protocol/kernel/apis/ExperimentalAPI.gen'
import { PortContext } from './context'

/** @deprecated this is only for experimental purposes */
export function registerExperimentalAPIServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, ExperimentalAPIServiceDefinition, async () => ({
    async sendToRenderer(req, ctx) {
      const protocol = await rendererProtocol
      return protocol.crdtService.sendCrdt({
        sceneId: ctx.sceneData.id,
        payload: req.data,
        sceneNumber: ctx.sceneData.sceneNumber
      })
    },

    async messageFromRenderer(_, ctx) {
      const protocol = await rendererProtocol
      const response = await protocol.crdtService.pullCrdt({
        sceneId: ctx.sceneData.id,
        sceneNumber: ctx.sceneData.sceneNumber
      })
      return { data: [response.payload] }
    }
  }))
}
