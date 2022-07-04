import { AnyAction } from 'redux'
import { ProfileState } from './types'
import {
  ADDED_PROFILE_TO_CATALOG,
  PROFILE_SUCCESS,
  PROFILE_FAILURE,
  PROFILE_REQUEST,
  ProfileSuccessAction,
  PROFILES_SUCCESS,
  PROFILES_REQUEST,
  ProfilesSuccessAction,
  ProfilesFailureAction,
  PROFILES_FAILURE
} from './actions'

const INITIAL_PROFILES: ProfileState = {
  userInfo: {}
}

export function profileReducer(state?: ProfileState, action?: AnyAction): ProfileState {
  if (!state) {
    return INITIAL_PROFILES
  }
  if (!action) {
    return state
  }
  switch (action.type) {
    case PROFILE_REQUEST:
      return {
        ...state,
        userInfo: {
          ...state.userInfo,
          [action.payload.userId]: { ...state.userInfo[action.payload.userId], status: 'loading' }
        }
      }
    case PROFILE_SUCCESS:
      const { profile } = (action as ProfileSuccessAction).payload
      return {
        ...state,
        userInfo: {
          ...state.userInfo,
          [profile.userId]: {
            ...state.userInfo[profile.userId],
            data: profile,
            status: 'ok'
          }
        }
      }
    case PROFILES_REQUEST:
      return {
        ...state,
        userInfo: {
          ...state.userInfo,
          [action.payload.userId]: { ...state.userInfo[action.payload.userId], status: 'loading' }
        }
      }
    case PROFILES_SUCCESS:
      const { profiles } = (action as ProfilesSuccessAction).payload
      const profilesState = {}
      for (const profile of profiles) {
        profilesState[profile.userId] = {
          data: profile,
          status: 'ok'
        }
      }

      return {
        ...state,
        userInfo: {
          ...state.userInfo,
          ...profilesState
        }
      }

    case PROFILES_FAILURE:
      const { userIds } = (action as ProfilesFailureAction).payload

      const newProfilesState = {}
      for (const userId of userIds) {
        newProfilesState[userId] = { status: 'error', data: action.payload.error }
      }

      return {
        ...state,
        userInfo: {
          ...state.userInfo,
          ...newProfilesState
        }
      }
    case PROFILE_FAILURE:
      return {
        ...state,
        userInfo: {
          ...state.userInfo,
          [action.payload.userId]: { status: 'error', data: action.payload.error }
        }
      }
    case ADDED_PROFILE_TO_CATALOG:
      return {
        ...state,
        userInfo: {
          ...state.userInfo,
          [action.payload.userId]: {
            ...state.userInfo[action.payload.userId],
            addedToCatalog: true
          }
        }
      }
    default:
      return state
  }
}
