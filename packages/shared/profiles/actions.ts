import { Avatar } from '@dcl/schemas'
import { action } from 'typesafe-actions'
import { ProfileType } from './types'

// Profile fetching

export const PROFILE_REQUEST = '[PROFILE] Fetch request'
export const PROFILE_SUCCESS = '[PROFILE] Fetch succeeded'
export const PROFILE_FAILURE = '[PROFILE] Fetch failed'
export const SAVE_PROFILE_DELTA = '[PROFILE] Save delta'
export const SEND_PROFILE_TO_RENDERER = '[PROFILE] Save delta succeeded'
export const SAVE_PROFILE_FAILURE = '[PROFILE] Save delta failed'

export const profileRequest = (userId: string, profileType?: ProfileType, version?: number) =>
  action(PROFILE_REQUEST, { userId, profileType, version })
export const profileSuccess = (userId: string, profile: Avatar, hasConnectedWeb3: boolean = false) =>
  action(PROFILE_SUCCESS, { userId, profile, hasConnectedWeb3 })
export const profileFailure = (userId: string, error: any) => action(PROFILE_FAILURE, { userId, error })

export type ProfileRequestAction = ReturnType<typeof profileRequest>
export type ProfileSuccessAction = ReturnType<typeof profileSuccess>
export type ProfileFailureAction = ReturnType<typeof profileFailure>

// Profile update

export const saveProfileDelta = (profile: Partial<Avatar>) => action(SAVE_PROFILE_DELTA, { profile })
export const sendProfileToRenderer = (userId: string, version: number, profile: Avatar) =>
  action(SEND_PROFILE_TO_RENDERER, { userId, version, profile })
export const saveProfileFailure = (userId: string, error: any) => action(SAVE_PROFILE_FAILURE, { userId, error })

export type SaveProfileDelta = ReturnType<typeof saveProfileDelta>
export type SendProfileToRenderer = ReturnType<typeof sendProfileToRenderer>
export type SaveProfileFailure = ReturnType<typeof saveProfileFailure>

export const DEPLOY_PROFILE_SUCCESS = '[Success] Deploy Profile'
export const DEPLOY_PROFILE_REQUEST = '[Request] Deploy Profile'
export const DEPLOY_PROFILE_FAILURE = '[Failure] Deploy Profile'
export const deployProfile = (profile: Avatar) => action(DEPLOY_PROFILE_REQUEST, { profile })
export const deployProfileSuccess = (userId: string, version: number, profile: Avatar) =>
  action(DEPLOY_PROFILE_SUCCESS, { userId, version, profile })
export const deployProfileFailure = (userId: string, profile: Avatar, error: any) =>
  action(DEPLOY_PROFILE_FAILURE, { userId, profile, error })

export type DeployProfileSuccess = ReturnType<typeof deployProfileSuccess>
export type DeployProfile = ReturnType<typeof deployProfile>

export const PROFILE_SAVED_NOT_DEPLOYED = 'Profile not deployed'
export const profileSavedNotDeployed = (userId: string, version: number, profile: Avatar) =>
  action(PROFILE_SAVED_NOT_DEPLOYED, { userId, version, profile })
export type ProfileSavedNotDeployed = ReturnType<typeof profileSavedNotDeployed>

export const ADDED_PROFILE_TO_CATALOG = '[Success] Added profile to catalog'
export const addedProfileToCatalog = (userId: string, profile: Avatar) =>
  action(ADDED_PROFILE_TO_CATALOG, { userId, profile })
export type AddedProfileToCatalog = ReturnType<typeof addedProfileToCatalog>

// Profiles over comms
export const LOCAL_PROFILE_RECEIVED = 'Local Profile Received'
export const localProfileReceived = (userId: string, profile: Avatar) =>
  action(LOCAL_PROFILE_RECEIVED, { userId, profile })
export type LocalProfileReceived = ReturnType<typeof localProfileReceived>

export const ANNOUNCE_PROFILE = '[Request] Announce profile to nearby users'
export const announceProfile = (userId: string, version: number) => action(ANNOUNCE_PROFILE, { userId, version })
export type AnnounceProfileAction = ReturnType<typeof announceProfile>
