import { AnyAction } from 'redux'
import { ProfileState } from './types'
import {
  ADDED_PROFILE_TO_CATALOG,
  PROFILE_SUCCESS,
  PROFILE_FAILURE,
  PROFILE_REQUEST,
  LOCAL_PROFILE_IN_RENDERER,
  ADD_WEARABLES_PORTABLE_EXPERIENCE,
  REMOVE_WEARABLES_PORTABLE_EXPERIENCE
} from './actions'

const INITIAL_PROFILES: ProfileState = {
  userInfo: {},
  localProfileUploaded: false,
  activeWearablesWithPortableExperiences: []
}

export function profileReducer(state?: ProfileState, action?: AnyAction): ProfileState {
  if (!state) {
    return INITIAL_PROFILES
  }
  if (!action) {
    return state
  }
  switch (action.type) {
    case LOCAL_PROFILE_IN_RENDERER:
      return {
        ...state,
        localProfileUploaded: true
      }
    case PROFILE_REQUEST:
      return {
        ...state,
        userInfo: {
          ...state.userInfo,
          [action.payload.userId]: { ...state.userInfo[action.payload.userId], status: 'loading' }
        }
      }
    case PROFILE_SUCCESS:
      return {
        ...state,
        userInfo: {
          ...state.userInfo,
          [action.payload.userId]: {
            data: action.payload.profile,
            status: 'ok',
            hasConnectedWeb3: action.payload.hasConnectedWeb3
          }
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
    case ADD_WEARABLES_PORTABLE_EXPERIENCE:
      return {
        ...state,
        activeWearablesWithPortableExperiences: state.activeWearablesWithPortableExperiences.concat(
          action.payload.wearables
        )
      }
    case REMOVE_WEARABLES_PORTABLE_EXPERIENCE:
      return {
        ...state,
        activeWearablesWithPortableExperiences: state.activeWearablesWithPortableExperiences.filter(
          (wId) => !action.payload.wearables.includes(wId)
        )
      }
    default:
      return state
  }
}
