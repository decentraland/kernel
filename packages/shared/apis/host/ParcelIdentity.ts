import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import { ParcelIdentityServiceDefinition } from '../gen/ParcelIdentity'
import { PortContextService } from './context'

export function registerParcelIdentityServiceServerImplementation(
  port: RpcServerPort<PortContextService<'ParcelIdentity'>>
) {
  codegen.registerService(port, ParcelIdentityServiceDefinition, async () => ({
    async realGetParcel(_req, ctx) {
      return {
        land: {
          ...ctx.ParcelIdentity.land,
          sceneJsonData: JSON.stringify(ctx.ParcelIdentity.land.sceneJsonData)
        },
        cid: ctx.ParcelIdentity.cid
      } as any
    },
    async realGetSceneId(_req, ctx) {
      const sceneId = ctx.ParcelIdentity.land.sceneId || ctx.ParcelIdentity.cid || ''
      return { sceneId }
    },
    async realGetIsEmpty(_req, ctx) {
      return { isEmpty: ctx.ParcelIdentity.isEmpty }
    }
  }))
}
