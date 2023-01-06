import { RpcServerPort } from '@dcl/rpc'
import { RendererProtocolContext } from '../context'
import * as codegen from '@dcl/rpc/dist/codegen'
import {
  FriendsKernelServiceDefinition,
  GetFriendshipStatusResponse
} from '@dcl/protocol/out-ts/decentraland/renderer/kernel_services/friends_kernel.gen'
import { getFriendshipStatus } from 'shared/friends/sagas'

export function registerFriendsKernelService(port: RpcServerPort<RendererProtocolContext>) {
  codegen.registerService(port, FriendsKernelServiceDefinition, async () => ({
    async getFriendshipStatus(req, _) {
      const handleGetFriendship = await handleRequest(getFriendshipStatus, req)

      const response: GetFriendshipStatusResponse = {
        status: handleGetFriendship
      }

      return response
    }
  }))
}

/**
 * Abstract the flow of request handling of friends kernel service.
 * @param handler - a function that takes in a request object and returns a Promise of a ResponseType object.
 * @param req - a request object.
 */
async function handleRequest<T, U>(handler: (r: T) => U, req: T) {
  // Handle request
  const internalResponse = await handler(req)

  // Send response back to renderer
  return internalResponse
}
