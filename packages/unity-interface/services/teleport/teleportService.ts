import { TeleportServiceDefinition } from '../../../renderer-protocol/proto/Teleport.gen'
import * as codegen from '@dcl/rpc/dist/codegen'

export function registerTeleportService() {
    codegen.registerService(port, TeleportServiceDefinition, async () => ({

      }))
}