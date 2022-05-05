import { Avatar } from '@dcl/schemas'
import { isFriend } from 'shared/friends/selectors'
import { RootFriendsState } from 'shared/friends/types'
import { getBannedUsers } from 'shared/meta/selectors'
import { BannedUsers, RootMetaState } from 'shared/meta/types'
import { getProfile } from 'shared/profiles/selectors'
import { RootProfileState } from 'shared/profiles/types'
import { getIdentity } from 'shared/session'
import { isVoiceChatAllowedByCurrentScene, getVoicePolicy } from './selectors'
import { RootCommsState, VoicePolicy } from './types'

export function isBlockedOrBanned(profile: Avatar, bannedUsers: BannedUsers, userId: string): boolean {
  return isBlocked(profile, userId) || isBannedFromChat(bannedUsers, userId)
}

function isBannedFromChat(bannedUsers: BannedUsers, userId: string): boolean {
  const bannedUser = bannedUsers[userId]
  return bannedUser && bannedUser.some((it) => it.type === 'VOICE_CHAT_AND_CHAT' && it.expiration > Date.now())
}

function isBlocked(profile: Avatar, userId: string): boolean {
  return !!profile.blocked && profile.blocked.includes(userId)
}

function hasBlockedMe(state: RootProfileState, myAddress: string | undefined, theirAddress: string): boolean {
  const profile = getProfile(state, theirAddress)

  return !!profile && !!myAddress && isBlocked(profile, myAddress)
}

function isMuted(profile: Avatar, userId: string): boolean {
  return !!profile.muted && profile.muted.includes(userId)
}

export function shouldPlayVoice(
  state: RootCommsState & RootFriendsState & RootProfileState & RootMetaState,
  profile: Avatar,
  voiceUserId: string
) {
  const myAddress = getIdentity()?.address
  return (
    isVoiceAllowedByPolicy(state, voiceUserId) &&
    !isBlockedOrBanned(profile, getBannedUsers(state), voiceUserId) &&
    !isMuted(profile, voiceUserId) &&
    !hasBlockedMe(state, myAddress, voiceUserId) &&
    isVoiceChatAllowedByCurrentScene()
  )
}

export function isVoiceAllowedByPolicy(
  state: RootCommsState & RootFriendsState & RootProfileState,
  voiceUserId: string
): boolean {
  const policy = getVoicePolicy(state)

  switch (policy) {
    case VoicePolicy.ALLOW_FRIENDS_ONLY:
      return isFriend(state, voiceUserId)
    case VoicePolicy.ALLOW_VERIFIED_ONLY:
      const theirProfile = getProfile(state, voiceUserId)
      return !!theirProfile?.hasClaimedName
    default:
      return true
  }
}
