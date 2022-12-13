import { RpcServerPort } from '@dcl/rpc'
import { RendererProtocolContext } from '../context'
import * as codegen from '@dcl/rpc/dist/codegen'
import {
  CancelFriendRequestReply,
  FriendRequestKernelServiceDefinition,
  FriendshipErrorCode,
  GetFriendRequestsReply,
  SendFriendRequestReply
} from '@dcl/protocol/out-ts/decentraland/renderer/kernel_services/friend_request_kernel.gen'
import { cancelFriendRequest, getFriendRequestsProtocol, requestFriendship } from '../../../shared/friends/sagas'
import defaultLogger from '../../../shared/logger'

export function registerFriendRequestKernelService(port: RpcServerPort<RendererProtocolContext>) {
  codegen.registerService(port, FriendRequestKernelServiceDefinition, async () => ({
    async getFriendRequests(req, _) {
      try {
        // Go get friend requests
        const friendRequests = await getFriendRequestsProtocol(req)

        let getFriendRequestsReply: GetFriendRequestsReply = {}

        // Check the response type
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
        // Handle send friend request
        const sendFriendRequest = await requestFriendship(req)

        let sendFriendRequestReply: SendFriendRequestReply = {}

        // Check the response type
        if (sendFriendRequest.error !== null) {
          sendFriendRequestReply = {
            message: {
              $case: 'error',
              error: sendFriendRequest.error
            }
          }
        } else if (sendFriendRequest.reply.friendRequest) {
          sendFriendRequestReply = {
            message: {
              $case: 'reply',
              reply: {
                friendRequest: {
                  friendRequestId: sendFriendRequest.reply.friendRequest.friendRequestId,
                  timestamp: sendFriendRequest.reply.friendRequest.timestamp,
                  to: sendFriendRequest.reply.friendRequest.to,
                  from: sendFriendRequest.reply.friendRequest.from,
                  messageBody: sendFriendRequest.reply.friendRequest.messageBody
                }
              }
            }
          }
        }

        // Send response back to renderer
        return sendFriendRequestReply
      } catch (err) {
        defaultLogger.error('Error while sending friend request via rpc', err)

        const sendFriendRequestReply: SendFriendRequestReply = {
          message: {
            $case: 'error',
            error: FriendshipErrorCode.FEC_UNKNOWN
          }
        }

        // Send response back to renderer
        return sendFriendRequestReply
      }
    },

    async cancelFriendRequest(req, _) {
      try {
        // Handle cancel friend request
        const cancelFriend = await cancelFriendRequest(req)

        let cancelFriendRequestReply: CancelFriendRequestReply = {}

        // Check the response type
        if (cancelFriend.error !== null) {
          cancelFriendRequestReply = {
            message: {
              $case: 'error',
              error: cancelFriend.error
            }
          }
        } else if (cancelFriend.reply.friendRequest) {
          cancelFriendRequestReply = {
            message: {
              $case: 'reply',
              reply: {
                friendRequest: {
                  friendRequestId: cancelFriend.reply.friendRequest.friendRequestId,
                  timestamp: cancelFriend.reply.friendRequest.timestamp,
                  to: cancelFriend.reply.friendRequest.to,
                  from: cancelFriend.reply.friendRequest.from,
                  messageBody: cancelFriend.reply.friendRequest.messageBody
                }
              }
            }
          }
        }

        // Send response back to renderer
        return cancelFriendRequestReply
      } catch (err) {
        defaultLogger.error('Error while canceling friend request via rpc', err)

        const cancelFriendRequestReply: CancelFriendRequestReply = {
          message: {
            $case: 'error',
            error: FriendshipErrorCode.FEC_UNKNOWN
          }
        }

        // Send response back to renderer
        return cancelFriendRequestReply
      }
    },

    async acceptFriendRequest(req, _) {
      return {}
    },

    async rejectFriendRequest(req, _) {
      return {}
    }
  }))
}
