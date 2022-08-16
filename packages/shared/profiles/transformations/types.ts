import { ProfileForRenderer } from '@dcl/legacy-ecs'
import { Snapshots } from '@dcl/schemas'

export type NewProfileForRenderer = {
  userId: string
  ethAddress: string
  name: string
  // @deprecated
  email: string
  parcelsWithAccess: ProfileForRenderer['parcelsWithAccess']
  snapshots: Snapshots
  blocked: string[]
  muted: string[]
  tutorialStep: number
  hasConnectedWeb3: boolean
  hasClaimedName: boolean
  avatar: ProfileForRenderer['avatar'] & {
    emotes: {
      slot: number
      urn: string
    }[]
    version: number // @TODO: remove this once Emotes is fully released. This helps the Renderer to know if it should fetch Emotes separately.
  }

  // TODO evaluate usage of the following
  version: number
  description: string
  created_at: number
  updated_at: number
  inventory: string[]
  tutorialFlagsMask: number
}
