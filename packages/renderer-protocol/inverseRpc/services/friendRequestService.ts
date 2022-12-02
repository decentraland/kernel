import { RpcServerPort } from '@dcl/rpc'
import { RendererProtocolContext } from '../context'
import * as codegen from '@dcl/rpc/dist/codegen'
import { FriendRequestKernelServiceDefinition } from '@dcl/protocol/out-ts/decentraland/renderer/kernel_services/friend_request_kernel.gen'

export function registerFriendRequestKernelService(port: RpcServerPort<RendererProtocolContext>) {
  codegen.registerService(port, FriendRequestKernelServiceDefinition, async () => ({
    // (_) -> It's the context
    async getFriendRequests(req, _) {
      // Logic

      // Return
      return {
          requestedTo: [],
          requestedFrom: [],
          totalReceivedFriendRequests: 3,
          totalSentFriendRequests: 4
      }
    }
  }))
}
