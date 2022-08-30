import { ProfileStatus, ProfileUserInfo, RootProfileState } from './types'
import { getCurrentUserId } from 'shared/session/selectors'
import { RootSessionState } from 'shared/session/types'
import { Avatar } from '@dcl/schemas'
import { calculateDisplayName } from './transformations/processServerProfile'

export const getProfileStatusAndData = (
  store: RootProfileState,
  userId: string
): [ProfileStatus | undefined, Avatar | undefined] => [
  store?.profiles?.userInfo[userId]?.status,
  store?.profiles?.userInfo[userId]?.data
]

export const getProfileFromStore = (store: RootProfileState, userId: string): ProfileUserInfo | null =>
  getProfileValueIfOkOrLoading(
    store,
    userId,
    (info) => info,
    () => null
  )

export const getProfilesFromStore = (
  store: RootProfileState,
  userIds: string[],
  userNameOrId?: string
): Array<ProfileUserInfo> => {
  const profiles = userIds.map((userId) => getProfileFromStore(store, userId))
  return filterProfilesByUserNameOrId(profiles, userNameOrId)
}

export const getProfile = (store: RootProfileState, userId: string): Avatar | null =>
  getProfileValueIfOkOrLoading(
    store,
    userId,
    (info) => info.data as Avatar,
    () => null
  )

export const getCurrentUserProfile = (store: RootProfileState & RootSessionState): Avatar | null => {
  const currentUserId = getCurrentUserId(store)
  return currentUserId ? getProfile(store, currentUserId) : null
}

export const getCurrentUserProfileDirty = (store: RootProfileState & RootSessionState): Avatar | null => {
  const currentUserId = getCurrentUserId(store)
  if (!currentUserId) return null
  const [_status, data] = getProfileStatusAndData(store, currentUserId)
  return data || null
}

export const getCurrentUserProfileStatusAndData = (
  store: RootProfileState & RootSessionState
): [ProfileStatus | undefined, Avatar | undefined] => {
  const currentUserId = getCurrentUserId(store)
  return currentUserId ? getProfileStatusAndData(store, currentUserId) : [undefined, undefined]
}

export const findProfileByName = (store: RootProfileState, userName: string): Avatar | null =>
  store.profiles && store.profiles.userInfo
    ? Object.values(store.profiles.userInfo)
        .filter((user) => user.status === 'ok')
        .find(
          (user) =>
            user.data?.name.toLowerCase() === userName.toLowerCase() ||
            user.data?.userId.toLowerCase() === userName.toLowerCase() ||
            calculateDisplayName(user.data).toLowerCase() === userName.toLowerCase()
        )?.data || null
    : null

export const isAddedToCatalog = (store: RootProfileState, userId: string): boolean =>
  getProfileValueIfOkOrLoading(
    store,
    userId,
    (info) => !!info.addedToCatalog,
    () => false
  )

export const getEthereumAddress = (store: RootProfileState, userId: string): string | undefined =>
  getProfileValueIfOkOrLoading(
    store,
    userId,
    (info) => (info.data as Avatar).userId,
    () => undefined
  )

export function filterProfilesByUserNameOrId(
  profiles: Array<ProfileUserInfo | null>,
  userNameOrId: string | undefined
): Array<ProfileUserInfo> {
  return profiles.filter((friend) => {
    if (!friend || friend.status !== 'ok') {
      return false
    }
    if (!userNameOrId) {
      return true
    }
    // keep the ones userId or name includes the filter
    return (
      friend.data.userId.toLocaleLowerCase().includes(userNameOrId.toLocaleLowerCase()) ||
      friend.data.name.toLocaleLowerCase().includes(userNameOrId.toLocaleLowerCase())
    )
  }) as Array<ProfileUserInfo>
}

function getProfileValueIfOkOrLoading<T>(
  store: RootProfileState,
  userId: string,
  getter: (p: ProfileUserInfo) => T,
  ifNotFound: () => T
): T {
  return store.profiles &&
    store.profiles.userInfo &&
    store.profiles.userInfo[userId] &&
    (store.profiles.userInfo[userId].status === 'ok' || store.profiles.userInfo[userId].status === 'loading')
    ? getter(store.profiles.userInfo[userId])
    : ifNotFound()
}
