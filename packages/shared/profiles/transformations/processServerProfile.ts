import { filterInvalidNameCharacters } from '../utils/names'
import { createFakeName } from '../utils/fakeName'
import { Avatar } from '@dcl/schemas'

export function fixWearableIds(wearableId: string) {
  return wearableId.replace('/male_body', '/BaseMale').replace('/female_body', '/BaseFemale')
}

// TODO: enforce this in renderer
export function calculateDisplayName(userId: string, profile: Avatar): string {
  if (profile && profile.name && profile.hasClaimedName) {
    return profile.name
  }

  if (profile && profile.name) {
    return `${filterInvalidNameCharacters(profile.name)}#${userId.slice(-4)}`
  }

  return `${createFakeName()}#${userId.slice(-4)}`
}

export function processServerProfile(userId: string, receivedProfile: Avatar): Avatar {
  const snapshots: any = receivedProfile.avatar.snapshots

  if (snapshots.face) {
    if (!snapshots.face256) snapshots.face256 = snapshots.face
    delete snapshots.face256
  }

  return {
    userId,
    // @deprecated
    email: '',
    name: receivedProfile.name,
    hasClaimedName: receivedProfile.hasClaimedName || false,
    description: receivedProfile.description || '',
    ethAddress: receivedProfile.ethAddress || userId,
    avatar: receivedProfile.avatar,
    blocked: receivedProfile.blocked,
    muted: receivedProfile.muted,
    tutorialStep: receivedProfile.tutorialStep || 0,
    interests: receivedProfile.interests || [],
    version: receivedProfile.version || 1
  }
}
