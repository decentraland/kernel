import { RpcServerPort } from '@dcl/rpc'
import { RendererProtocolContext } from '../context'
import * as codegen from '@dcl/rpc/dist/codegen'

import { getFriendRequestsProtocol, requestFriendship } from '../../../shared/friends/sagas'
import defaultLogger from '../../../shared/logger'
import { FriendshipErrorCode } from '@dcl/protocol/out-ts/decentraland/renderer/common/friend_request_common.gen'
import {
  FriendRequestKernelServiceDefinition,
  GetFriendRequestsReply,
  SendFriendRequestReply
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
              reply: friendRequests.reply
            }
          }
        } else {
          getFriendRequestsReply = buildFriendRequestsError(friendRequests.error)
        }

        // Send response back to renderer
        return getFriendRequestsReply
      } catch (err) {
        defaultLogger.error('Error while getting friend requests via rpc', err)

        // Send response back to renderer
        return buildFriendRequestsError()
      }
    },

    async sendFriendRequest(req, _) {
      try {
        // Handle send friend request
        const sendFriendRequest = await requestFriendship(req)

        let sendFriendRequestReply: SendFriendRequestReply = {}

        // Check the response type
        if (sendFriendRequest.reply?.friendRequest) {
          sendFriendRequestReply = {
            message: {
              $case: 'reply',
              reply: sendFriendRequest.reply
            }
          }
        } else {
          sendFriendRequestReply = buildFriendRequestsError(sendFriendRequest.error)
        }

        // Send response back to renderer
        return sendFriendRequestReply
      } catch (err) {
        defaultLogger.error('Error while sending friend request via rpc', err)

        // Send response back to renderer
        return buildFriendRequestsError()
      }
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

type FriendshipError = { message: { $case: 'error'; error: FriendshipErrorCode } }

/**
 * Build get friend requests error message to send to renderer
 * @param error - an int representing an error code
 */
function buildFriendRequestsError(error?: FriendshipErrorCode): FriendshipError {
  return {
    message: {
      $case: 'error' as const,
      error: error ?? FriendshipErrorCode.FEC_UNKNOWN
    }
  }
}
