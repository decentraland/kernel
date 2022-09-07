import { getProfile, getProfileStatusAndData, isAddedToCatalog } from './selectors'
import { addedProfileToCatalog, profileRequest } from './actions'
import { ProfileType } from './types'
import { COMMS_PROFILE_TIMEOUT } from 'config'
import { store } from 'shared/store/isolatedStore'
import { Avatar } from '@dcl/schemas'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { profileToRendererFormat } from './transformations/profileToRendererFormat'
import { ensureUnityInterface } from 'shared/renderer'
import { isCurrentUserId } from 'shared/session/selectors'

// We resolve a profile with an older version after this time, if there is that info
const PROFILE_SOFT_TIMEOUT_MS = 5000

// We reject the profile promise if more time than this has passed
const PROFILE_HARD_TIMEOUT_MS = COMMS_PROFILE_TIMEOUT + 20000

// This method creates a promise that makes sure that a profile was downloaded AND added to renderer's catalog
export async function ProfileAsPromise(userId: string, version?: number, profileType?: ProfileType): Promise<Avatar> {
  function isExpectedVersion(aProfile: Avatar) {
    return !version || aProfile.version >= version
  }

  const [, existingProfile] = getProfileStatusAndData(store.getState(), userId)
  const existingProfileWithCorrectVersion = existingProfile && isExpectedVersion(existingProfile)
  const isInCatalog = isAddedToCatalog(store.getState(), userId)
  if (existingProfile && existingProfileWithCorrectVersion && !isCurrentUserId(store.getState(), userId)) {
    if (!isInCatalog) {
      await ensureUnityInterface()
      getUnityInstance().AddUserProfileToCatalog(profileToRendererFormat(existingProfile, {}))
      store.dispatch(addedProfileToCatalog(userId, existingProfile))
    }
    return existingProfile
  }
  return new Promise<Avatar>((resolve, reject) => {
    let pending = true
    const unsubscribe = store.subscribe(() => {
      const [status, data] = getProfileStatusAndData(store.getState(), userId)

      if (status === 'error') {
        unsubscribe()
        pending = false
        return reject(data)
      }

      const profile = getProfile(store.getState(), userId)
      if (profile && isExpectedVersion(profile) && status === 'ok' && isAddedToCatalog(store.getState(), userId)) {
        unsubscribe()
        pending = false
        return resolve(profile)
      }
    })
    store.dispatch(profileRequest(userId, profileType, version))

    setTimeout(() => {
      if (pending) {
        const profile = getProfile(store.getState(), userId)

        if (profile) {
          unsubscribe()
          pending = false
          resolve(profile)
        } else {
          setTimeout(() => {
            if (pending) {
              unsubscribe()
              pending = false
              reject(new Error(`Timed out trying to resolve profile ${userId} (version: ${version})`))
            }
          }, PROFILE_HARD_TIMEOUT_MS - PROFILE_SOFT_TIMEOUT_MS)
        }
      }
    }, PROFILE_SOFT_TIMEOUT_MS)
  })
}

export function getProfileIfExist(userId: string): Avatar | null {
  return getProfile(store.getState(), userId)
}
