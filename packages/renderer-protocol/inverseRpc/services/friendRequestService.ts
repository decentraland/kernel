import { RpcServerPort } from '@dcl/rpc'
import { RendererProtocolContext } from '../context'
import * as codegen from '@dcl/rpc/dist/codegen'
import {
  FriendRequestKernelServiceDefinition,
  GetFriendRequestsReply
} from '@dcl/protocol/out-ts/decentraland/renderer/kernel_services/friend_request_kernel.gen'
import { getFriendRequestsNew } from '../../../shared/friends/sagas'
import { FriendshipErrorCode } from '@dcl/protocol/out-ts/decentraland/renderer/common/friends.gen'

export function registerFriendRequestKernelService(port: RpcServerPort<RendererProtocolContext>) {
  codegen.registerService(port, FriendRequestKernelServiceDefinition, async () => ({
    // (_) -> It's the context
    async getFriendRequests(req, _) {
      try {
        const friendRequestReply = await getFriendRequestsNew({
          sentLimit: req.sentLimit,
          sentSkip: req.sentSkip,
          receivedLimit: req.receivedLimit,
          receivedSkip: req.receivedSkip
        })

        const getFriendRequestsReply: GetFriendRequestsReply = {
          message: {
            $case: 'reply',
            reply: {
              requestedTo: friendRequestReply.requestedTo,
              requestedFrom: friendRequestReply.requestedFrom,
              totalReceivedFriendRequests: friendRequestReply.totalReceivedFriendRequests,
              totalSentFriendRequests: friendRequestReply.totalSentFriendRequests
            }
          }
        }

        return getFriendRequestsReply
      } catch {
        const getFriendRequestsReply: GetFriendRequestsReply = {
          message: {
            $case: 'error',
            error: FriendshipErrorCode.FEC_UNKNOWN
          }
        }

        return getFriendRequestsReply
      }
    }
  }))
}
