import { analizeColorPart, stripAlpha } from './analizeColorPart'
import { isValidBodyShape } from './isValidBodyShape'
import { WearableId } from '@dcl/legacy-ecs'
import { Avatar, AvatarInfo, Profile } from '@dcl/schemas'
import { AvatarForUserData } from 'shared/types'
import { validateAvatar } from '../schemaValidation'
import { trackEvent } from 'shared/analytics'

type OldAvatar = Omit<Avatar, 'avatar'> & {
  avatar: AvatarForUserData
}

export function ensureAvatarCompatibilityFormat(profile: Readonly<Avatar | OldAvatar>): Avatar {
  const avatarInfo: AvatarInfo = {} as any

  // These mappings from legacy id are here just in case they still have the legacy id in local storage
  avatarInfo.bodyShape = mapLegacyIdToUrn(profile.avatar.bodyShape)
  avatarInfo.wearables = profile.avatar.wearables.map(mapLegacyIdToUrn)
  avatarInfo.snapshots = profile.avatar.snapshots

  if ('eyeColor' in profile.avatar) {
    const eyes = stripAlpha(analizeColorPart(avatarInfo, 'eyeColor', 'eyes'))
    const hair = stripAlpha(analizeColorPart(avatarInfo, 'hairColor', 'hair'))
    const skin = stripAlpha(analizeColorPart(avatarInfo, 'skinColor', 'skin'))
    avatarInfo.eyes = { color: eyes }
    avatarInfo.hair = { color: hair }
    avatarInfo.skin = { color: skin }
  } else {
    avatarInfo.eyes = profile.avatar.eyes
    avatarInfo.hair = profile.avatar.hair
    avatarInfo.skin = profile.avatar.skin
  }

  const invalidWearables =
    !avatarInfo.wearables ||
    !Array.isArray(avatarInfo.wearables) ||
    !avatarInfo.wearables.reduce((prev: boolean, next: any) => prev && typeof next === 'string', true)

  if (invalidWearables) {
    throw new Error('Invalid Wearables array! Received: ' + JSON.stringify(avatarInfo))
  }
  const snapshots = avatarInfo.snapshots as any
  if ('face' in snapshots && !snapshots.face256) {
    snapshots.face256 = snapshots.face!
    delete snapshots['face']
  }
  if (!avatarInfo.snapshots || !avatarInfo.snapshots.face256 || !avatarInfo.snapshots.body) {
    throw new Error('Invalid snapshot data:' + JSON.stringify(avatarInfo.snapshots))
  }
  if (!avatarInfo.bodyShape || !isValidBodyShape(avatarInfo.bodyShape)) {
    throw new Error('Invalid BodyShape! Received: ' + JSON.stringify(avatarInfo))
  }

  const ret: Avatar = {
    ...profile,
    avatar: avatarInfo
  }

  if (!validateAvatar(ret)) {
    trackEvent('invalid_schema', { schema: 'avatar', payload: ret })
    debugger
  }

  return ret
}

function mapLegacyIdToUrn(wearableId: WearableId): WearableId {
  if (!wearableId.startsWith('dcl://')) {
    return wearableId
  }
  if (wearableId.startsWith('dcl://base-avatars')) {
    const name = wearableId.substring(wearableId.lastIndexOf('/') + 1)
    return `urn:decentraland:off-chain:base-avatars:${name}`
  } else {
    const [collectionName, wearableName] = wearableId.replace('dcl://', '').split('/')
    return `urn:decentraland:ethereum:collections-v1:${collectionName}:${wearableName}`
  }
}

export function buildServerMetadata(profile: Avatar): Profile {
  const newProfile = ensureAvatarCompatibilityFormat(profile)
  const metadata = { avatars: [newProfile] }
  return metadata
}
