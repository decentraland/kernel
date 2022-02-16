import { ReadOnlyColor4 } from '@dcl/legacy-ecs'
import { WearableId } from 'shared/catalogs/types'

export interface Profile {
  userId: string
  name: string
  hasClaimedName: boolean
  description: string
  email: string
  avatar: Avatar
  ethAddress: string
  blocked?: string[]
  muted?: string[]
  version: number
  tutorialStep: number
  interests?: string[]
  unclaimedName: string
}

export interface Avatar {
  bodyShape: WearableId
  skinColor: ColorString
  hairColor: ColorString
  eyeColor: ColorString
  wearables: WearableId[]
  snapshots: Snapshots
}

export type Snapshots = {
  face256: string
  body: string
}

type AvatarForRenderer = {
  bodyShape: WearableId
  skinColor: ReadOnlyColor4
  hairColor: ReadOnlyColor4
  eyeColor: ReadOnlyColor4
  wearables: WearableId[]
}

enum LandRole {
  OWNER = 'owner',
  OPERATOR = 'operator'
}

type ParcelsWithAccess = Array<{
  x: number
  y: number
  role: LandRole
}>

export type ProfileForRenderer = {
  userId: string
  name: string
  description: string
  email: string
  avatar: AvatarForRenderer
  snapshots: Snapshots
  version: number
  hasConnectedWeb3: boolean
  updatedAt?: number
  createdAt?: number
  parcelsWithAccess?: ParcelsWithAccess
}

export type ColorString = string

export type ProfileStatus = 'ok' | 'error' | 'loading'

export type ProfileUserInfo =
  | { status: 'loading' | 'error'; data: any; hasConnectedWeb3: boolean; addedToCatalog?: boolean }
  | { status: 'ok'; data: Profile; hasConnectedWeb3: boolean; addedToCatalog?: boolean }

export type ProfileState = {
  userInfo: {
    [key: string]: ProfileUserInfo
  }
  localProfileUploaded: boolean
}

export type RootProfileState = {
  profiles: ProfileState
}

export type ContentFile = {
  name: string
  content: Buffer
}

export enum ProfileType {
  LOCAL,
  DEPLOYED
}
