import { RpcServerPort } from '@dcl/rpc'
import { RendererProtocolContext } from '../context'
import * as codegen from '@dcl/rpc/dist/codegen'
import {
  FriendRequestKernelServiceDefinition,
  FriendshipErrorCode,
  GetFriendRequestsReply,
  SendFriendRequestReply
} from '@dcl/protocol/out-ts/decentraland/renderer/kernel_services/friend_request_kernel.gen'
import { getFriendRequestsProtocol, requestFriendship } from '../../../shared/friends/sagas'
import defaultLogger from '../../../shared/logger'

export function registerFriendRequestKernelService(port: RpcServerPort<RendererProtocolContext>) {
  codegen.registerService(port, FriendRequestKernelServiceDefinition, async () => ({
    async getFriendRequests(req, _) {
      try {
        // Go get friend requests
        const friendRequests = await getFriendRequestsProtocol(req)

        let getFriendRequestsReply: GetFriendRequestsReply = {}

        // Check the response
        if (friendRequests.error !== null) {
          getFriendRequestsReply = {
            message: {
              $case: 'error',
              error: FriendshipErrorCode.FEC_UNKNOWN
            }
          }
        } else {
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
      try {
        const requestFriendshipReply = await requestFriendship(req)

        return {}
      } catch {
        const sendFriendRequestReply: SendFriendRequestReply = {
          message: {
            $case: 'error',
            error: FriendshipErrorCode.FEC_UNKNOWN
          }
        }
        return sendFriendRequestReply
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
