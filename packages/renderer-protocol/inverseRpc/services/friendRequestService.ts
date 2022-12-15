import { RpcServerPort } from '@dcl/rpc'
import { RendererProtocolContext } from '../context'
import * as codegen from '@dcl/rpc/dist/codegen'

import { getFriendRequestsProtocol } from '../../../shared/friends/sagas'
import defaultLogger from '../../../shared/logger'
import { FriendshipErrorCode } from '@dcl/protocol/out-ts/decentraland/renderer/common/friend_request_common.gen'
import {
  FriendRequestKernelServiceDefinition,
  GetFriendRequestsReply
} from '@dcl/protocol/out-ts/decentraland/renderer/kernel_services/friend_request_kernel.gen'

export function registerFriendRequestKernelService(port: RpcServerPort<RendererProtocolContext>) {
  codegen.registerService(port, FriendRequestKernelServiceDefinition, async () => ({
    async getFriendRequests(req, _) {
      try {
        // Go get friend requests
        const friendRequests = await getFriendRequestsProtocol(req)

        let getFriendRequestsReply: GetFriendRequestsReply = {}

        // Check the response type
        if (friendRequests.reply) {
          getFriendRequestsReply = {
            message: {
              $case: 'reply',
              reply: {
                requestedTo: friendRequests.reply.requestedTo,
                requestedFrom: friendRequests.reply.requestedFrom,
                totalReceivedFriendRequests: friendRequests.reply.totalReceivedFriendRequests,
                totalSentFriendRequests: friendRequests.reply.totalSentFriendRequests
              }
            }
          }
        } else {
          getFriendRequestsReply = {
            message: {
              $case: 'error',
              error: friendRequests.error ?? FriendshipErrorCode.FEC_UNKNOWN
            }
          }
        }

        // Send response back to renderer
        return getFriendRequestsReply
      } catch (err) {
        defaultLogger.error('Error while getting friend requests via rpc', err)

        const getFriendRequestsReply: GetFriendRequestsReply = {
          message: {
            $case: 'error',
            error: FriendshipErrorCode.FEC_UNKNOWN
          }
        }

        // Send response back to renderer
        return getFriendRequestsReply
      }
    },

    async sendFriendRequest(req, _) {
      return {}
    },

    async cancelFriendRequest(req, _) {
      return {}
    },

    async acceptFriendRequest(req, _) {
      return {}
    },

    async rejectFriendRequest(req, _) {
      return {}
    }
  }))
}
