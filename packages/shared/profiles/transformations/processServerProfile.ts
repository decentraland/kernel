import { filterInvalidNameCharacters } from '../utils/names'
import { createFakeName } from '../utils/fakeName'
import { Avatar } from '@dcl/schemas'

export function fixWearableIds(wearableId: string) {
  return wearableId.replace('/male_body', '/BaseMale').replace('/female_body', '/BaseFemale')
}

// TODO: enforce this in renderer
export function calculateDisplayName(profile: Avatar): string {
  const lastPart = `#${profile.userId.slice(-4)}`

  const name = filterInvalidNameCharacters(
    profile
      ? profile.name.endsWith(lastPart)
        ? profile.name.substring(0, profile.name.length - lastPart.length)
        : profile.name
      : createFakeName()
  )

  if (profile && profile.hasClaimedName) {
    return name
  }

  return `${name}${lastPart}`
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
    version: receivedProfile.version || 0
  }
}
