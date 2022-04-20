import { Avatar } from '@dcl/schemas'

export type ProfileStatus = 'ok' | 'error' | 'loading'

export type ProfileUserInfo =
  | { status: 'loading' | 'error'; data: any; hasConnectedWeb3: boolean; addedToCatalog?: boolean }
  | { status: 'ok'; data: Avatar; hasConnectedWeb3: boolean; addedToCatalog?: boolean }

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

export enum ProfileType {
  LOCAL,
  DEPLOYED
}
