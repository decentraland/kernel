import { isFriend } from 'shared/friends/selectors'
import { getBannedUsers } from 'shared/meta/selectors'
import { BannedUsers } from 'shared/meta/types'
import { getProfile } from 'shared/profiles/selectors'
import { isFeatureToggleEnabled } from 'shared/selectors'
import { getIdentity } from 'shared/session'
import { store } from 'shared/store/isolatedStore'
import { Profile, SceneFeatureToggles } from 'shared/types'
import { lastPlayerScene } from 'shared/world/sceneState'
import { RootCommsState, VoicePolicy } from './types'

export const isVoiceChatRecording = (store: RootCommsState) => store.comms.voiceChatRecording

export const getVoicePolicy = (store: RootCommsState) => store.comms.voicePolicy

export const getCommsIsland = (store: RootCommsState): string | undefined => store.comms.island

export const getPreferedIsland = (store: RootCommsState) => store.comms.preferedIsland

export function shouldPlayVoice(profile: Profile, voiceUserId: string) {
  const myAddress = getIdentity()?.address
  return (
    isVoiceAllowedByPolicy(profile, voiceUserId) &&
    !isBlockedOrBanned(profile, getBannedUsers(store.getState()), voiceUserId) &&
    !isMuted(profile, voiceUserId) &&
    !hasBlockedMe(myAddress, voiceUserId) &&
    isVoiceChatAllowedByCurrentScene()
  )
}

export function isVoiceAllowedByPolicy(profile: Profile, voiceUserId: string): boolean {
  const policy = getVoicePolicy(store.getState())

  switch (policy) {
    case VoicePolicy.ALLOW_FRIENDS_ONLY:
      return isFriend(store.getState(), voiceUserId)
    case VoicePolicy.ALLOW_VERIFIED_ONLY:
      const theirProfile = getProfile(store.getState(), voiceUserId)
      return !!theirProfile?.hasClaimedName
    default:
      return true
  }
}

export function isVoiceChatAllowedByCurrentScene() {
  return isFeatureToggleEnabled(SceneFeatureToggles.VOICE_CHAT, lastPlayerScene?.sceneJsonData)
}

export function isBlockedOrBanned(profile: Profile, bannedUsers: BannedUsers, userId: string): boolean {
  return isBlocked(profile, userId) || isBannedFromChat(bannedUsers, userId)
}

export function isBannedFromChat(bannedUsers: BannedUsers, userId: string): boolean {
  const bannedUser = bannedUsers[userId]
  return bannedUser && bannedUser.some((it) => it.type === 'VOICE_CHAT_AND_CHAT' && it.expiration > Date.now())
}

export function isBlocked(profile: Profile, userId: string): boolean {
  return !!profile.blocked && profile.blocked.includes(userId)
}

export function isMuted(profile: Profile, userId: string): boolean {
  return !!profile.muted && profile.muted.includes(userId)
}

export function hasBlockedMe(myAddress: string | undefined, theirAddress: string): boolean {
  const profile = getProfile(store.getState(), theirAddress)

  return !!profile && !!myAddress && isBlocked(profile, myAddress)
}
