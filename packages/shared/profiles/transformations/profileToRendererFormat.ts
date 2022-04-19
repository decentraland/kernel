import { Profile } from '../types'
import { ParcelsWithAccess, ProfileForRenderer } from '@dcl/legacy-ecs'
import { convertToRGBObject } from './convertToRGBObject'
import { dropDeprecatedWearables } from './processServerProfile'
import { ExplorerIdentity } from 'shared/session/types'
import { isURL } from 'atomicHelpers/isURL'
import { trackEvent } from '../../analytics'
import { Snapshots } from '@dcl/schemas'

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
function prepareSnapshots({ face256, body }: Snapshots, userId: string): ProfileForRenderer['snapshots'] {
  // TODO: move this logic to unity-renderer
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

  const x = prepare(face256)
  // TODO: this "as any" comes from the ProfileForRenderer['snapshots'] in @dcl/legacy-ecs
  // which only accepts {face, body} the new types accept {face256, body}
  return { body: prepare(body), face256: x } as any
}
