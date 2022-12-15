import { RpcServerPort } from '@dcl/rpc'
import { RendererProtocolContext } from '../context'
import * as codegen from '@dcl/rpc/dist/codegen'

import {
  acceptFriendRequest,
  cancelFriendRequest,
  getFriendRequestsProtocol,
  rejectFriendRequest,
  requestFriendship
} from '../../../shared/friends/sagas'
import defaultLogger from '../../../shared/logger'
import { FriendshipErrorCode } from '@dcl/protocol/out-ts/decentraland/renderer/common/friend_request_common.gen'
import {
  AcceptFriendRequestReply,
  CancelFriendRequestReply,
  FriendRequestKernelServiceDefinition,
  GetFriendRequestsReply,
  RejectFriendRequestReply,
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
      try {
        // Handle send friend request
        const sendFriendRequest = await requestFriendship(req)

        let sendFriendRequestReply: SendFriendRequestReply = {}

        // Check the response type
        if (sendFriendRequest.reply?.friendRequest) {
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
        } else {
          sendFriendRequestReply = {
            message: {
              $case: 'error',
              error: sendFriendRequest.error ?? FriendshipErrorCode.FEC_UNKNOWN
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
        if (cancelFriend.reply?.friendRequest) {
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
        } else {
          cancelFriendRequestReply = {
            message: {
              $case: 'error',
              error: cancelFriend.error ?? FriendshipErrorCode.FEC_UNKNOWN
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
      try {
        // Handle reject friend request
        const acceptFriend = await acceptFriendRequest(req)

        let acceptFriendRequestReply: AcceptFriendRequestReply = {}

        // Check response type
        if (acceptFriend.reply?.friendRequest) {
          acceptFriendRequestReply = {
            message: {
              $case: 'reply',
              reply: acceptFriend.reply
            }
          }
        } else {
          acceptFriendRequestReply = {
            message: {
              $case: 'error',
              error: acceptFriend.error ?? FriendshipErrorCode.FEC_UNKNOWN
            }
          }
        }

        // Send response back to renderer
        return acceptFriendRequestReply
      } catch (err) {
        defaultLogger.error('Error while accepting friend request via rpc', err)

        const acceptFriendRequestReply: AcceptFriendRequestReply = {
          message: {
            $case: 'error',
            error: FriendshipErrorCode.FEC_UNKNOWN
          }
        }

        // Send response back to renderer
        return acceptFriendRequestReply
      }
    },

    async rejectFriendRequest(req, _) {
      try {
        // Handle reject friend request
        const rejectFriend = await rejectFriendRequest(req)

        let rejectFriendRequestReply: RejectFriendRequestReply = {}

        // Check response type
        if (rejectFriend.reply?.friendRequest) {
          rejectFriendRequestReply = {
            message: {
              $case: 'reply',
              reply: rejectFriend.reply
            }
          }
        } else {
          rejectFriendRequestReply = {
            message: {
              $case: 'error',
              error: rejectFriend.error ?? FriendshipErrorCode.FEC_UNKNOWN
            }
          }
        }

        // Send response back to renderer
        return rejectFriendRequestReply
      } catch (err) {
        defaultLogger.error('Error while rejecting friend request via rpc', err)

        const rejectFriendRequestReply: RejectFriendRequestReply = {
          message: {
            $case: 'error',
            error: FriendshipErrorCode.FEC_UNKNOWN
          }
        }

        // Send response back to renderer
        return rejectFriendRequestReply
      }
    }
  }))
}
