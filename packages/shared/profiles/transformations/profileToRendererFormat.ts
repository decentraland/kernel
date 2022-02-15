import { Profile, ProfileForRenderer } from '../types'
import { ParcelsWithAccess } from '@dcl/legacy-ecs'
import { convertToRGBObject } from './convertToRGBObject'
import { dropDeprecatedWearables } from './processServerProfile'
import { ExplorerIdentity } from 'shared/session/types'
import { isURL } from 'atomicHelpers/isURL'
import { trackEvent } from '../../analytics'

const profileDefaults = {
  tutorialStep: 0
}

export function profileToRendererFormat(
  profile: Profile,
  options?: { identity?: ExplorerIdentity; parcels?: ParcelsWithAccess }
): ProfileForRenderer {
  const { snapshots, ...rendererAvatar } = profile.avatar

  return {
    ...profileDefaults,
    ...profile,
    snapshots: prepareSnapshots(snapshots, profile.userId),
    hasConnectedWeb3: options?.identity ? options.identity.hasConnectedWeb3 : false,
    avatar: {
      ...rendererAvatar,
      wearables: profile.avatar.wearables.filter(dropDeprecatedWearables),
      eyeColor: convertToRGBObject(profile.avatar.eyeColor),
      hairColor: convertToRGBObject(profile.avatar.hairColor),
      skinColor: convertToRGBObject(profile.avatar.skinColor)
    },
    parcelsWithAccess: options?.parcels
  }
}

// Ensure all snapshots are URLs
function prepareSnapshots(
  { face256, body }: { face256: string; body: string },
  userId: string
): {
  face256: string
  body: string
  face?: string
  face128?: string
} {
  function prepare(value: string) {
    if (value === null || value === undefined) {
      trackEvent('SNAPSHOT_IMAGE_NOT_FOUND', { userId })
      return '/images/image_not_found.png'
    }
    if (value === '' || isURL(value) || value.startsWith('/images')) {
      return value
    }

    return 'data:text/plain;base64,' + value
  }

  const face = prepare(face256)
  return { face, face128: face, face256: face, body: prepare(body) }
}
