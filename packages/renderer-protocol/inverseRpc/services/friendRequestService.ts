import { RpcServerPort } from '@dcl/rpc'
import { RendererProtocolContext } from '../context'
import * as codegen from '@dcl/rpc/dist/codegen'

import { cancelFriendRequest, getFriendRequestsProtocol, requestFriendship } from '../../../shared/friends/sagas'
import defaultLogger from '../../../shared/logger'
import { FriendshipErrorCode } from '@dcl/protocol/out-ts/decentraland/renderer/common/friend_request_common.gen'
import {
  CancelFriendRequestReply,
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

        // Build send friend request reply
        const getFriendRequestsReply: GetFriendRequestsReply = buildResponse(friendRequests.reply, friendRequests.error)

        // Send response back to renderer
        return getFriendRequestsReply
      } catch (err) {
        defaultLogger.error('Error while getting friend requests via rpc', err)

        // Send response back to renderer
        return buildErrorResponse()
      }
    },

    async sendFriendRequest(req, _) {
      try {
        // Handle send friend request
        const sendFriendRequest = await requestFriendship(req)

        // Build send friend request reply
        const sendFriendRequestReply: SendFriendRequestReply = buildResponse(
          sendFriendRequest.reply,
          sendFriendRequest.error
        )

        // Send response back to renderer
        return sendFriendRequestReply
      } catch (err) {
        defaultLogger.error('Error while sending friend request via rpc', err)

        // Send response back to renderer
        return buildErrorResponse()
      }
    },

    async cancelFriendRequest(req, _) {
      try {
        // Handle cancel friend request
        const cancelFriend = await cancelFriendRequest(req)

        // Build cancel friend request reply
        const cancelFriendRequestReply: CancelFriendRequestReply = buildResponse(cancelFriend.reply, cancelFriend.error)

        // Send response back to renderer
        return cancelFriendRequestReply
      } catch (err) {
        defaultLogger.error('Error while canceling friend request via rpc', err)

        // Send response back to renderer
        return buildErrorResponse()
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

type FriendshipError = { message: { $case: 'error'; error: FriendshipErrorCode } }

/**
 * Build friend requests error message to send to renderer.
 * @param error - an int representing an error code.
 */
function buildErrorResponse(error?: FriendshipErrorCode): FriendshipError {
  return {
    message: {
      $case: 'error' as const,
      error: error ?? FriendshipErrorCode.FEC_UNKNOWN
    }
  }
}

/**
 * Build friend requests success message to send to renderer.
 * @param reply - a FriendRequestReplyOk kind of type.
 */
function wrapReply<T>(reply: T) {
  return { message: { $case: 'reply' as const, reply: reply as NonNullable<T> } }
}

/**
 * Build friend requests message to send to renderer.
 * If the friendRequest object is truthy, the function returns the result of calling `wrapReply` on the `friendRequest` object.
 * If the friendRequest object is falsy, the function returns the result of calling `buildErrorResponse` with the `error` value.
 * @param friendRequest - it can represent any kind of FriendRequestReplyOk type.
 * @param error - an int representing an error code.
 */
function buildResponse<T>(friendRequest: T, error?: FriendshipErrorCode) {
  if (friendRequest) {
    return wrapReply(friendRequest)
  } else {
    return buildErrorResponse(error)
  }
}
