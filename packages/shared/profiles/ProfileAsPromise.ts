import { getProfile, getProfileStatusAndData } from './selectors'
import { profileRequest, profilesRequest } from './actions'
import { ProfileType } from './types'
import { COMMS_PROFILE_TIMEOUT } from 'config'
import { store } from 'shared/store/isolatedStore'
import { Avatar } from '@dcl/schemas'

// We resolve a profile with an older version after this time, if there is that info
const PROFILE_SOFT_TIMEOUT_MS = 5000

// We reject the profile promise if more time than this has passed
const PROFILE_HARD_TIMEOUT_MS = COMMS_PROFILE_TIMEOUT + 20000

export function ProfilesAsPromise(userIds: string[], version?: number, profileType?: ProfileType): Promise<Avatar[]> {
  function isExpectedVersion(aProfile: Avatar) {
    return !version || aProfile.version >= version
  }

  const usersToFech = userIds.filter((userId) => {
    const [, existingProfile] = getProfileStatusAndData(store.getState(), userId)
    const existingProfileWithCorrectVersion = existingProfile && isExpectedVersion(existingProfile)

    // if it already exists we don't want to fetch it
    return existingProfile && existingProfileWithCorrectVersion
  })

  let pending = true

  return new Promise<Avatar[]>((resolve, reject) => {
    const unsubscribe = store.subscribe(() => {
      const avatars: Avatar[] = []

      for (const userId of userIds) {
        const [status, data] = getProfileStatusAndData(store.getState(), userId)

        if (status === 'error') {
          unsubscribe()
          pending = false
          return reject(data)
        }

        const profile = getProfile(store.getState(), userId)
        if (profile && isExpectedVersion(profile) && status === 'ok') {
          avatars.push(profile)
        }
      }

      if (avatars.length === userIds.length) {
        unsubscribe()
        pending = false
        resolve(avatars)
      }
    })

    if (usersToFech.length > 0) {
      store.dispatch(profilesRequest(usersToFech, profileType, version))
    }

    setTimeout(() => {
      // if it's pending it means that the promise has already resolved since none's clearing the timeout
      if (!pending) {
        return
      }
      const profiles = userIds
        .map((userId) => getProfile(store.getState(), userId))
        .filter((profile) => profile != null) as Avatar[]

      if (profiles.length === userIds.length) {
        unsubscribe()
        pending = false
        resolve(profiles)
      } else {
        setTimeout(() => {
          // if it's pending it means that the promise has already resolved since none's clearing the timeout
          if (!pending) {
            return
          }

          unsubscribe()
          pending = false
          reject(new Error(`Timed out trying to resolve profiles ${userIds} (version: ${version})`))
        }, PROFILE_HARD_TIMEOUT_MS - PROFILE_SOFT_TIMEOUT_MS)
      }
    }, PROFILE_SOFT_TIMEOUT_MS)
  })
}

export function ProfilesAsPromise(userIds: string[], profileType?: ProfileType): Promise<Avatar[]> {
  const usersToFech = userIds.filter((userId) => {
    const [, existingProfile] = getProfileStatusAndData(store.getState(), userId)
    const existingProfileWithCorrectVersion = existingProfile

    // if it already exists we don't want to fetch it
    return !(existingProfile && existingProfileWithCorrectVersion)
  })

  let pending = true

  return new Promise<Avatar[]>((resolve, reject) => {
    const unsubscribe = store.subscribe(() => {
      const avatars: Avatar[] = []

      for (const userId of userIds) {
        const [status, data] = getProfileStatusAndData(store.getState(), userId)

        if (status === 'error') {
          unsubscribe()
          pending = false
          return reject(data)
        }

        const profile = getProfile(store.getState(), userId)
        if (profile && status === 'ok') {
          avatars.push(profile)
        }
      }

      if (avatars.length === userIds.length) {
        unsubscribe()
        pending = false
        resolve(avatars)
      }
    })

    if (usersToFech.length > 0) {
      store.dispatch(profilesRequest(usersToFech, profileType))
    }

    setTimeout(() => {
      // if it's pending it means that the promise has already resolved since none's clearing the timeout
      if (!pending) {
        return
      }
      const profiles = userIds
        .map((userId) => getProfile(store.getState(), userId))
        .filter((profile) => !!profile) as Avatar[]

      if (profiles.length === userIds.length) {
        unsubscribe()
        pending = false
        resolve(profiles)
      } else {
        setTimeout(() => {
          // if it's pending it means that the promise has already resolved since none's clearing the timeout
          if (!pending) {
            return
          }

          unsubscribe()
          pending = false
          reject(new Error(`Timed out trying to resolve profiles ${userIds}`))
        }, PROFILE_HARD_TIMEOUT_MS - PROFILE_SOFT_TIMEOUT_MS)
      }
    }, PROFILE_SOFT_TIMEOUT_MS)
  })
}

export function getProfileIfExist(userId: string): Avatar | null {
  return getProfile(store.getState(), userId)
}
