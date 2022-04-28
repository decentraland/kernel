import { Avatar } from '@dcl/schemas'

export type ProfileStatus = 'ok' | 'error' | 'loading'

export type ProfileUserInfo = { status: 'ok' | 'loading' | 'error'; data: Avatar; addedToCatalog?: boolean }

export type ProfileState = {
  userInfo: {
    [key: string]: ProfileUserInfo
  }
}

export type RootProfileState = {
  profiles: ProfileState
}

export type ContentFile = {
  name: string
  content: Buffer
}

// NEVER CHANGE THIS ENUM, IT IS USED IN THE WIRE PROTOCOL
export enum ProfileType {
  LOCAL = 0,
  DEPLOYED = 1
}
