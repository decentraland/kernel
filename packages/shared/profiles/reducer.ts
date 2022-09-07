import { AnyAction } from 'redux'
import { ProfileState } from './types'
import {
  ADDED_PROFILE_TO_CATALOG,
  PROFILE_SUCCESS,
  PROFILE_FAILURE,
  PROFILE_REQUEST,
  ProfileSuccessAction,
  AddedProfilesToCatalog,
  ADDED_PROFILES_TO_CATALOG,
  ProfileFailureAction
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
    case PROFILE_FAILURE:
      const { userId } = (action as ProfileFailureAction).payload

      return {
        ...state,
        userInfo: {
          ...state.userInfo,
          [userId]: { status: 'error', data: action.payload.error }
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

    case ADDED_PROFILES_TO_CATALOG:
      const addedProfiles = (action as AddedProfilesToCatalog).payload.profiles
      const updatedProfilesState = {}
      for (const profile of addedProfiles) {
        updatedProfilesState[profile.userId] = {
          ...state.userInfo[profile.userId],
          addedToCatalog: true
        }
      }

      return {
        ...state,
        userInfo: {
          ...state.userInfo,
          ...updatedProfilesState
        }
      }
    default:
      return state
  }
}
