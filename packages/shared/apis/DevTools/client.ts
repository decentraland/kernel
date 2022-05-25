import { loadService } from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { DevToolsServiceDefinition } from './gen/DevTools'

export const createDevToolsServiceClient = <Context>(clientPort: RpcClientPort) =>
  loadService<Context, DevToolsServiceDefinition>(clientPort, DevToolsServiceDefinition)
