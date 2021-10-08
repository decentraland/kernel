import { KernelConfigForRenderer } from 'shared/types'
import { commConfigurations, WSS_ENABLED } from 'config'
import { nameValidCharacterRegex, nameValidRegex } from 'shared/profiles/utils/names'
import { getWorld } from '@dcl/schemas'
import { injectVersions } from 'shared/rolloutVersions'

export function kernelConfigForRenderer(): KernelConfigForRenderer {
  const versions = injectVersions({})
  return {
    comms: {
      commRadius: commConfigurations.commRadius,
      voiceChatEnabled: false
    },
    profiles: {
      nameValidCharacterRegex: nameValidCharacterRegex.toString().replace(/[/]/g, ''),
      nameValidRegex: nameValidRegex.toString().replace(/[/]/g, '')
    },
    gifSupported:
      // tslint:disable-next-line
      typeof OffscreenCanvas !== 'undefined' && typeof OffscreenCanvasRenderingContext2D === 'function' && !WSS_ENABLED,
    network: "mainnet",
    validWorldRanges: getWorld().validWorldRanges,
    kernelVersion: versions['@dcl/kernel'] || "unknown-kernel-version",
    rendererVersion: versions['@dcl/unity-renderer'] || "unknown-renderer-version"
  }
}
