import { ReadOnlyColor4 } from '@dcl/ecs-math'
import { Snapshots } from '@dcl/schemas'

export declare type AvatarForRenderer = {
  bodyShape: string
  skinColor: ReadOnlyColor4
  hairColor: ReadOnlyColor4
  eyeColor: ReadOnlyColor4
  wearables: string[]
}

export type ProfileForRenderer = {
  userId: string
  name: string
  description: string
  email: string
  avatar: AvatarForRenderer
  snapshots: {
    face256: string
    body: string
  }
  version: number
  hasConnectedWeb3: boolean
  updatedAt?: number
  createdAt?: number
  parcelsWithAccess?: ParcelsWithAccess
}

export type ParcelsWithAccess = Array<{
  x: number
  y: number
  role: string
}>

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
  avatar: ProfileForRenderer['avatar']

  // TODO evaluate usage of the following
  version: number
  description: string
  created_at: number
  updated_at: number
  inventory: string[]
  tutorialFlagsMask: number
}
