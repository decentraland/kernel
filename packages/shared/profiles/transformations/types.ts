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
  baseUrl: string
  avatar: ProfileForRenderer['avatar'] & {
    emotes: {
      slot: number
      urn: string
    }[]
  }

  // TODO evaluate usage of the following
  version: number
  description: string
  created_at: number
  updated_at: number
  inventory: string[]
  tutorialFlagsMask: number
}

export interface AddUserProfilesToCatalogPayload {
  users: NewProfileForRenderer[]
}
